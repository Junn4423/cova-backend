import { CreateInventoryLevelInput, ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils";
import {
  createInventoryLevelsWorkflow,
  createStockLocationsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows";

/**
 * Script to update inventory levels for all products that don't have inventory.
 * Run with: npx medusa exec src/scripts/update-inventory.ts
 */
export default async function updateInventory({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const inventoryService = container.resolve(Modules.INVENTORY);
  const stockLocationService = container.resolve(Modules.STOCK_LOCATION);
  const salesChannelService = container.resolve(Modules.SALES_CHANNEL);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);

  logger.info("Starting inventory update...");

  // Get all stock locations
  let stockLocations = await stockLocationService.listStockLocations({});
  
  if (!stockLocations.length) {
    logger.info("No stock locations found! Creating one...");
    
    // Create a stock location
    const { result: stockLocationResult } = await createStockLocationsWorkflow(container).run({
      input: {
        locations: [
          {
            name: "Vietnam Warehouse",
            address: {
              city: "Ho Chi Minh City",
              country_code: "VN",
              address_1: "123 Main Street",
            },
          },
        ],
      },
    });
    
    stockLocations = stockLocationResult;
    logger.info(`Created stock location: ${stockLocations[0].name}`);
    
    // Link to fulfillment provider
    await link.create({
      [Modules.STOCK_LOCATION]: {
        stock_location_id: stockLocations[0].id,
      },
      [Modules.FULFILLMENT]: {
        fulfillment_provider_id: "manual_manual",
      },
    });
    
    // Link to default sales channel
    const salesChannels = await salesChannelService.listSalesChannels({
      name: "Default Sales Channel",
    });
    
    if (salesChannels.length) {
      await linkSalesChannelsToStockLocationWorkflow(container).run({
        input: {
          id: stockLocations[0].id,
          add: [salesChannels[0].id],
        },
      });
      logger.info(`Linked stock location to sales channel: ${salesChannels[0].name}`);
    }
  }

  const stockLocation = stockLocations[0];
  logger.info(`Using stock location: ${stockLocation.name} (${stockLocation.id})`);

  // Get all inventory items
  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id", "sku"],
  });

  logger.info(`Found ${inventoryItems.length} inventory items`);

  // Get existing inventory levels
  const existingLevels = await inventoryService.listInventoryLevels({
    location_id: stockLocation.id,
  });

  const existingItemIds = new Set(existingLevels.map((level: any) => level.inventory_item_id));
  logger.info(`Found ${existingLevels.length} existing inventory levels`);

  // Filter items that don't have inventory levels yet
  const itemsNeedingInventory = inventoryItems.filter(
    (item: any) => !existingItemIds.has(item.id)
  );

  if (itemsNeedingInventory.length === 0) {
    logger.info("All inventory items already have levels. Updating existing levels to 1000...");
    
    // Update existing levels to have stock
    for (const level of existingLevels) {
      if (level.stocked_quantity === 0) {
        await inventoryService.updateInventoryLevels([{
          inventory_item_id: level.inventory_item_id,
          location_id: level.location_id,
          stocked_quantity: 1000,
        }]);
      }
    }
    
    logger.info("Finished updating inventory levels.");
    return;
  }

  logger.info(`Creating inventory levels for ${itemsNeedingInventory.length} items...`);

  const inventoryLevels: CreateInventoryLevelInput[] = itemsNeedingInventory.map(
    (item: any) => ({
      location_id: stockLocation.id,
      stocked_quantity: 1000, // Set initial stock to 1000
      inventory_item_id: item.id,
    })
  );

  await createInventoryLevelsWorkflow(container).run({
    input: {
      inventory_levels: inventoryLevels,
    },
  });

  logger.info(`Successfully created ${inventoryLevels.length} inventory levels.`);
  logger.info("Inventory update completed!");
}
