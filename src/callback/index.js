import { getDbPool } from '/opt/nodejs/db/connection.js';
import {
    SecretsManagerClient,
    GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import { randomUUID } from 'node:crypto';

export const handler = async (event) => {
    try {
        console.log('event: ', event);
        const provider = event.pathParameters?.provider;
        const code = event.queryStringParameters?.code;
        const state = event.queryStringParameters?.state;

        const dbPool = await getDbPool('write_read_rds_db'); // shoud use read thing here because that is safer before the validation check
        const dbResult = await dbPool.query(
            `
            SELECT "userId"
            FROM "OAuthState"
              WHERE "state" = $1
              AND "provider" = $2
              AND "usedAt" IS NULL
              AND "expiresAt" > $3
            LIMIT 1
            `,
            [state, provider, new Date()]
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

        await dbPool.query(
            `
            UPDATE "OAuthState"
            SET "usedAt" = $1
            WHERE "state" = $2
              AND "provider" = $3
              AND "usedAt" IS NULL
            `,
            [new Date(), state, provider]
        );

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
            `https://api2.notifications.benjaminreinecke.click/providers/${provider}/oauth-connections/callback`;

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

        const team = tokenExchangeResult.team ?? {};
        const incomingWebhook = tokenExchangeResult.incoming_webhook ?? {};
        const now = new Date();
        const oAuthConnectionId = randomUUID()

        const connectionResult = await dbPool.query(
            `
            INSERT INTO "OAuthConnection" (
              "id",
              "userId",
              "provider",
              "providerAccountId",
              "authData",
              "createdAt"
            )
            VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT ("userId", "provider", "providerAccountId")
                DO UPDATE SET
                "authData" = EXCLUDED."authData"
                returning *
            `,
            [
                oAuthConnectionId,
                dbResult.rows[0].userId,
                provider,
                team.id,
                {
                    scopes: tokenExchangeResult.scope,
                    workspaceId: team.id,
                    workspaceName: team.name,
                    accessToken: tokenExchangeResult.access_token,
                },
                now
            ]
        );

        const connection = connectionResult.rows[0];

        await dbPool.query(
            `
            INSERT INTO "Destination" (
              "id",
              "userId",
              "channelType",
              "metadata",
              "oAuthConnectionId",
              "createdAt"
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            `,
            [
                randomUUID(),
                dbResult.rows[0].userId,
                "slack",
                {
                    webhookUrl: incomingWebhook.url,
                    configurationUrl: incomingWebhook.configuration_url,
                    channelId: incomingWebhook.channel_id,
                    channelName: incomingWebhook.channel,
                },
                connection.oAuthConnectionId,
                now
            ]
        );

        return {
            statusCode: 302,
            headers: {
                "Location": 'https://notifications.benjaminreinecke.click/oauth/slack?status=success',
                'Content-Type': 'application/json',
            },
        };
    } catch (e) {
        return {
            headers: {
                "Location": 'https://notifications.benjaminreinecke.click/oauth/slack?status=error',
                'Content-Type': 'application/json',
            },
            statusCode: 302,

            body: JSON.stringify({
                error: { message: e.message },
            }),
        };
    }
};
