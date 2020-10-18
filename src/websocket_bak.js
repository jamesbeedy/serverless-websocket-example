#!/usr/bin/python3
import os


from boto3 import client
from boto3.ApiGatewayManagementApi.Client.exceptions import (
    GoneException,
    LimitExceededException,
    PayloadTooLargeException,
    ForbiddenException,
)


CONNECTION_TABLE = os.environ['CONNECTIONS_TABLE'];

APIGW = boto3.client('apigatewaymanagementapi')
DYNAMODB = boto3.client('dynamodb')


def send_message(connection_id, body):
    try:
        apigw.post_to_connection({
            'ConnectionId': connectionId,
            'Data': body
        })
    except (GoneException,
            LimitExceededException,
            PayloadTooLargeException,
            ForbiddenException) as e:
        print(e)

def get_all_connections(exclusive_start_key=None):

    db_scan = DYNAMODB.scan(
        TableName=CONNECTION_TABLE,
        IndexName='string',
        AttributesToGet=[
            'connectionId',
        ],
    )
    items = db_scan['Items']
    last_evaluated_key = db_scan['LastEvaluatedKey']



async function getAllConnections(ExclusiveStartKey) {


  const { Items, LastEvaluatedKey } = await dynamodb.scan({
    TableName: connectionTable,
    AttributesToGet: [ 'connectionId' ],
    ExclusiveStartKey
  }).promise();

  const connections = Items.map(({ connectionId }) => connectionId);
  if(LastEvaluatedKey && (currentConnectionId != connectionId)) {
    connections.push(...await getAllConnections(currentConnectionId, LastEvaluatedKey));
  }

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
      const connections = await getAllConnections(connectionId, null);
      await Promise.all(
        connections.map(connectionId => sendMessage(connectionId, body))
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
