import hal from 'halson'
import { getDbPool } from '/opt/nodejs/db/connection.js';

export const handler = async (event) => {
    try{
        const channelId = event.pathParameters?.channelId;
        const userId = event?.requestContext?.authorizer?.jwt?.claims?.sub;

        const stateHash = crypto.randomBytes(32).toString("hex");

        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        const createdAt = new Date(Date.now());
        const dbPool = await getDbPool('write_read_rds_db');

        await dbPool.query(
            `
    INSERT INTO "OAuthState" (
      "id",                        
      "userId",
      "provider",
      "stateHash",
                              "metadata",
      "expiresAt",
                              "usedAt",
                              "createdAt"
    )
    VALUES ($1, $2, $3, $4, $5,$6,$7,$8)
  `,
            [
                stateHash,
                userId,
                channelId,
                stateHash,
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
            stateHash,
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