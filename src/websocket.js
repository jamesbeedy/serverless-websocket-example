const AWS = require('aws-sdk');
const apig = new AWS.ApiGatewayManagementApi({
  endpoint: process.env.APIG_ENDPOINT
});
const dynamodb = new AWS.DynamoDB.DocumentClient();

const connectionTable = process.env.CONNECTIONS_TABLE;


async function sendMessage(connectionId, body) {
  try {
    await apig.postToConnection({
      ConnectionId: connectionId,
      Data: body
    }).promise();
  } catch (err) {
    // Ignore if connection no longer exists
    if(err.statusCode !== 400 && err.statusCode !== 410) {
      throw err;
    }
  }
}

async function getAllConnections(ExclusiveStartKey) {
  const { Items, LastEvaluatedKey } = await dynamodb.scan({
    TableName: connectionTable,
    AttributesToGet: [ 'connectionId' ],
    ExclusiveStartKey
  }).promise();

  const connections = Items.map(({ connectionId }) => connectionId);
  if(LastEvaluatedKey) {
    connections.push(...await getAllConnections(LastEvaluatedKey));
  }
  console.log("******* [CONNECTIONS] ****** ", connections); 

  return connections;
}



exports.handler = async function(event, context) {
  // For debug purposes only.
  // You should not log any sensitive information in production.
  console.log("EVENT: \n" + JSON.stringify(event, null, 2));

  const { body, requestContext: { connectionId, routeKey }} = event;
  switch(routeKey) {
    case '$connect':
      await dynamodb.put({
        TableName: connectionTable,
        Item: {
          connectionId,
          // Expire the connection an hour later. This is optional, but recommended.
          // You will have to decide how often to time out and/or refresh the ttl.
          ttl: parseInt((Date.now() / 1000) + 3600)
        }
      }).promise();
      break;

    case '$disconnect':
      await dynamodb.delete({
        TableName: connectionTable,
        Key: { connectionId }
      }).promise();
      break;

    case 'routeA':
      const connections = await getAllConnections();
      const conn = connections.filter(item => item !== connectionId)

      await Promise.all(
        conn.map(connectionId => sendMessage(connectionId, body))
      );
      break;

    case '$default':
    default:
      await apig.postToConnection({
        ConnectionId: connectionId,
        Data: `Received on default: ${body}`
      }).promise();
      break;

      //await apig.postToConnection({
      //  ConnectionId: connectionId,
      // Data: `Received on $default: ${body}`
      //}).promise();
  }

  // Return a 200 status to tell API Gateway the message was processed
  // successfully.
  // Otherwise, API Gateway will return a 500 to the client.
  return { statusCode: 200 };
}
