export const handler = async (event) => {
    try {
        console.log('event: ', event);
        const channelId = event.pathParameters?.channelId;
        const code = event.queryStringParameters?.code;
        const state = event.queryStringParameters?.state;

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                channelId,
                code,
                state,
            }),
        };
    } catch (e) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: { message: e.message },
            }),
        };
    }
};
