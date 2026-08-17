import hal from 'halson'
import { getDbPool } from '/opt/nodejs/db/connection.js';
import { randomUUID } from 'node:crypto';

export const handler = async (event) => {
    try{
        // console.log('NODE_ENV:', process.env.NODE_ENV);
        // console.log('SLACK_CLIENT_ID:', process.env.SLACK_CLIENT_ID);
        console.log('event: ', event);
        const channelId = event.pathParameters?.channelId; // validate this

        if (channelId !== 'slack') {
            return {
                statusCode: 404,
                body: JSON.stringify({
                    error: {
                        message: `Unsupported channel: ${channelId}`,
                    },
                }),
            };
        }


        const userId = event?.requestContext?.authorizer?.jwt?.claims?.sub;

        const state = randomUUID();

        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        const createdAt = new Date(Date.now());
        const dbPool = await getDbPool('write_read_rds_db');

        await dbPool.query(
            `
    INSERT INTO "OAuthState" (
      "id",                        
      "userId",
      "provider",
      "state",
                              "metadata",
      "expiresAt",
                              "usedAt",
                              "createdAt"
    )
    VALUES ($1, $2, $3, $4, $5,$6,$7,$8)
  `,
            [
                state,
                userId,
                channelId,
                state,
                {},
                expiresAt,
                null,
                createdAt
            ]
        );


        const params = new URLSearchParams({
            client_id: process.env.SLACK_CLIENT_ID,
            scope: "incoming-webhook",
            redirect_uri:
        `https://api2.notifications.benjaminreinecke.click/channels/${channelId}/oauth-connections/callback`,
            state,
    });

        const authorizationUrl =
            `https://slack.com/oauth/v2/authorize?${params.toString()}`;


        const resource = hal({authorizationUrl}).addLink('self', `https://api2.notifications.benjaminreinecke.click/channels/${channelId}/oauth-connections`);
        return {
            statusCode: 200,
            headers: {
                // Location: resourceHref,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(resource),
        };
    } catch (e) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: { message: e.message },
            }),
        };
    }

}