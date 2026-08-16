import hal from 'halson'

export const handler = async (event) => {
    try{

        const resource = hal({one: 'hello'}).addLink('self', 'noLink');
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