/**
 * Monday.com API Integration
 * Handles fetching caregiver data from Monday.com boards
 */

/**
 * Monday.com GraphQL API
 */
const MONDAY_API_URL = 'https://api.monday.com/v2';

/**
 * Execute a Monday.com GraphQL query
 * @param {string} query - GraphQL query
 * @param {Object} variables - Query variables
 * @param {Object} logger - Logger instance
 * @returns {Promise<Object>} API response data
 */
async function executeMondayQuery(query, variables = {}, logger) {
  const apiToken = process.env.MONDAY_API_TOKEN;

  if (!apiToken) {
    throw new Error('MONDAY_API_TOKEN not set in .env file');
  }

  logger.debug('Executing Monday.com API query...');

  const response = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': apiToken,
      'API-Version': '2024-01'
    },
    body: JSON.stringify({
      query,
      variables
    })
  });

  if (!response.ok) {
    throw new Error(`Monday.com API error: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();

  if (result.errors) {
    logger.error('Monday.com API errors:', JSON.stringify(result.errors, null, 2));
    throw new Error(`Monday.com API error: ${result.errors[0].message}`);
  }

  return result.data;
}

/**
 * Get all boards accessible to the user
 * @param {Object} logger - Logger instance
 * @returns {Promise<Array>} List of boards
 */
export async function getBoards(logger) {
  const query = `
    query {
      boards {
        id
        name
        description
        board_folder_id
        board_kind
        state
      }
    }
  `;

  const data = await executeMondayQuery(query, {}, logger);
  return data.boards;
}

/**
 * Get board columns (fields)
 * @param {string} boardId - Board ID
 * @param {Object} logger - Logger instance
 * @returns {Promise<Array>} List of columns
 */
export async function getBoardColumns(boardId, logger) {
  const query = `
    query ($boardId: [ID!]) {
      boards(ids: $boardId) {
        columns {
          id
          title
          type
          settings_str
        }
      }
    }
  `;

  const data = await executeMondayQuery(query, { boardId: [boardId] }, logger);
  return data.boards[0]?.columns || [];
}

/**
 * Get items (rows) from a board with specific status
 * @param {string} boardId - Board ID
 * @param {string} statusColumnId - Status column ID (optional)
 * @param {string} statusValue - Status value to filter by (optional)
 * @param {Object} logger - Logger instance
 * @returns {Promise<Array>} List of items
 */
export async function getBoardItems(boardId, statusColumnId = null, statusValue = null, logger) {
  let allItems = [];
  let cursor = null;
  let hasMore = true;

  // Fetch all items using pagination
  while (hasMore) {
    const query = `
      query ($boardId: [ID!], $cursor: String) {
        boards(ids: $boardId) {
          items_page(limit: 500, cursor: $cursor) {
            cursor
            items {
              id
              name
              column_values {
                id
                text
                value
                type
              }
            }
          }
        }
      }
    `;

    const data = await executeMondayQuery(query, { boardId: [boardId], cursor }, logger);
    const itemsPage = data.boards[0]?.items_page;

    if (!itemsPage || !itemsPage.items || itemsPage.items.length === 0) {
      hasMore = false;
      break;
    }

    allItems = allItems.concat(itemsPage.items);
    cursor = itemsPage.cursor;

    // If no cursor returned, we've reached the end
    if (!cursor) {
      hasMore = false;
    }

    logger.info(`Fetched ${allItems.length} items so far...`);
  }

  logger.info(`Total items fetched: ${allItems.length}`);

  // Filter by status if provided
  if (statusColumnId && statusValue) {
    const filteredItems = allItems.filter(item => {
      const statusCol = item.column_values.find(col => col.id === statusColumnId);
      return statusCol && statusCol.text?.toLowerCase() === statusValue.toLowerCase();
    });
    logger.info(`Filtered to ${filteredItems.length} items with status "${statusValue}"`);
    return filteredItems;
  }

  return allItems;
}

/**
 * Update item status
 * @param {string} boardId - Board ID
 * @param {string} itemId - Item ID
 * @param {string} statusColumnId - Status column ID
 * @param {string} statusValue - New status value
 * @param {Object} logger - Logger instance
 * @returns {Promise<Object>} Updated item
 */
export async function updateItemStatus(boardId, itemId, statusColumnId, statusValue, logger) {
  const query = `
    mutation ($boardId: ID!, $itemId: ID!, $columnId: String!, $value: JSON!) {
      change_simple_column_value(
        board_id: $boardId,
        item_id: $itemId,
        column_id: $columnId,
        value: $value
      ) {
        id
        name
      }
    }
  `;

  const variables = {
    boardId: boardId,
    itemId: itemId,
    columnId: statusColumnId,
    value: statusValue
  };

  const data = await executeMondayQuery(query, variables, logger);
  return data.change_simple_column_value;
}

/**
 * Parse caregiver data from Monday.com item
 * @param {Object} item - Monday.com item
 * @param {Object} columnMapping - Map of column IDs to field names
 * @returns {Object} Caregiver data object
 */
export function parseCaregiverData(item, columnMapping) {
  const caregiver = {
    mondayItemId: item.id,
    mondayItemName: item.name
  };

  // Extract column values based on mapping
  for (const columnValue of item.column_values) {
    const fieldName = columnMapping[columnValue.id];
    if (fieldName) {
      caregiver[fieldName] = columnValue.text || '';
    }
  }

  return caregiver;
}

/**
 * Get caregivers ready for entry into HHA Exchange
 * @param {string} boardId - Monday.com board ID
 * @param {string} statusColumnId - Status column ID
 * @param {string} readyStatusValue - Status value indicating ready for entry (e.g., "Ready for HHA")
 * @param {Object} columnMapping - Map of column IDs to field names
 * @param {Object} logger - Logger instance
 * @returns {Promise<Array>} List of caregiver objects
 */
export async function getCaregiversReadyForEntry(boardId, statusColumnId, readyStatusValue, columnMapping, logger) {
  logger.info(`Fetching caregivers from Monday.com board ${boardId}...`);
  logger.info(`Looking for items with status: "${readyStatusValue}"`);

  const items = await getBoardItems(boardId, statusColumnId, readyStatusValue, logger);

  logger.info(`Found ${items.length} caregivers ready for entry`);

  const caregivers = items.map(item => parseCaregiverData(item, columnMapping));

  return caregivers;
}

/**
 * Mark caregiver as entered in HHA Exchange
 * @param {string} boardId - Monday.com board ID
 * @param {string} itemId - Monday.com item ID
 * @param {string} statusColumnId - Status column ID
 * @param {string} completedStatusValue - Status value for completed (e.g., "Entered in HHA")
 * @param {Object} logger - Logger instance
 * @returns {Promise<void>}
 */
export async function markCaregiverAsEntered(boardId, itemId, statusColumnId, completedStatusValue, logger) {
  logger.info(`Updating Monday.com item ${itemId} status to "${completedStatusValue}"...`);

  await updateItemStatus(boardId, itemId, statusColumnId, completedStatusValue, logger);

  logger.info('Monday.com item updated successfully');
}
