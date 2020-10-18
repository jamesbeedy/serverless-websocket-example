#!/usr/bin/env python3
import asyncio
import json

import websockets


async def echo():
    uri = "wss://a05tkaz7a2.execute-api.us-west-2.amazonaws.com/dev"
    async with websockets.connect(uri) as websocket:
        async for message in websocket:
            print(message)        

asyncio.get_event_loop().run_until_complete(echo())
