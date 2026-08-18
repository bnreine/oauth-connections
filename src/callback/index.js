import { getDbPool } from '/opt/nodejs/db/connection.js';
import {
    SecretsManagerClient,
    GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

export const handler = async (event) => {
    try {
        console.log('event: ', event);
        const channelId = event.pathParameters?.channelId;
        const code = event.queryStringParameters?.code;
        const state = event.queryStringParameters?.state;
        const userId = event?.requestContext?.authorizer?.jwt?.claims?.sub;

        const dbPool = await getDbPool('write_read_rds_db');
        const dbResult = await dbPool.query(
            `
            SELECT 1
            FROM "OAuthState"
            WHERE "userId" = $1
              AND "state" = $2
              AND "provider" = $3
              AND "usedAt" IS NULL
              AND "expiresAt" > $4
            LIMIT 1
            `,
            [userId, state, channelId, new Date()]
        );

        if (dbResult.rowCount === 0) {
            return {
                statusCode: 404,
                body: JSON.stringify({
                    error: {
                        message: 'Not found',
                    },
                }),
            };
        }


        const clientId = process.env.SLACK_CLIENT_ID;
        const clientSecretName = process.env.SLACK_CLIENT_SECRET_NAME;

        const secretClient = new SecretsManagerClient({});

        const clientSecretResponse = await secretClient.send(
            new GetSecretValueCommand({
                SecretId: clientSecretName,
            }),
        );

        const secret = JSON.parse(clientSecretResponse.SecretString);

        const clientSecret = secret.clientSecret;

        const redirectUri =
            'https://api2.notifications.benjaminreinecke.click/channels/slack/oauth-connections/callback';

        const basicAuth = Buffer
            .from(`${clientId}:${clientSecret}`)
            .toString('base64');

        const body = new URLSearchParams({
            code,
            redirect_uri: redirectUri,
        });

        const slackTokenExchangeResponse = await fetch(
            'https://slack.com/api/oauth.v2.access',
            {
                method: 'POST',
                headers: {
                    Authorization: `Basic ${basicAuth}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body,
            }
        );

        const tokenExchangeResult = await slackTokenExchangeResponse.json();

        if (!slackTokenExchangeResponse.ok || !tokenExchangeResult.ok) {
            return {
                statusCode: 404,
                body: JSON.stringify({
                    error: {
                        message: 'Not found: slack oauth exchange failed',
                    },
                }),
            };
        }

        // console.log('to store: ', JSON.stringify({
        //     provider: 'slack',
        //
        //     externalAccountId: tokenExchangeResult.team.id,
        //
        //     metadata: {
        //         workspaceId: tokenExchangeResult.team.id,
        //         workspaceName: tokenExchangeResult.team.name,
        //
        //         channelId: tokenExchangeResult.incoming_webhook.channel_id,
        //         channelName: tokenExchangeResult.incoming_webhook.channel,
        //
        //         configurationUrl:
        //         tokenExchangeResult.incoming_webhook.configuration_url,
        //
        //         scopes: tokenExchangeResult.scope
        //     },
        //
        //     credentials: {
        //         webhookUrl: tokenExchangeResult.incoming_webhook.url
        //     }
        // }));

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                channelId,
                // code,
                // state,
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
