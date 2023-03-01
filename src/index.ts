export interface Env {
    GOOGLE_API_KEY: string
}


export default {
    async fetch(
        request: Request,
        env: Env,
        ctx: ExecutionContext
    ): Promise<Response> {
        const url = new URL(request.url);

        if (url.pathname === "/") {
            return new Response("", {
                status: 302,
                headers: {
                    location: "https://github.com/gtoselli",
                },
            });
        }

        const [sheetId, sheetName, ...otherParams] = url.pathname
            .slice(1)
            .split("/")
            .filter((x) => x);

        if (!sheetId || !sheetName || otherParams.length > 0) {
            return error("URL format is /spreadsheet_id/sheet_name", 404);
        }


        const cache = caches.default;
        const cacheKey = request.url
        const cachedResponse = await cache.match(cacheKey);
        if (cachedResponse) {
            console.log(`Serving from cache: ${cacheKey}`);
            return cachedResponse;
        } else {
            console.log(`Cache miss: ${cacheKey}`);
        }


        const result: any = await (
            await fetch(
                `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetName}?key=${env.GOOGLE_API_KEY}`
            )
        ).json();

        if (result.error) {
            return error(result.error.message);
        }

        const rows: any[] = [];

        const rawRows: any[] = result.values || [];
        const headers = rawRows.shift();
        rawRows.forEach((row) => {
            const rowData: any = {};
            row.forEach((item: any, index: any) => {
                rowData[headers[index]] = item;
            });
            rows.push(rowData);
        });

        const apiResponse = new Response(JSON.stringify(rows), {
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": `s-maxage=30`,
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers":
                    "Origin, X-Requested-With, Content-Type, Accept",
            },
        });
        ctx.waitUntil(cache.put(cacheKey, apiResponse.clone()));
        return apiResponse;
    },
};

const error = (message: string, status = 400) => {
    return new Response(JSON.stringify({error: message}), {
        status: status,
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers":
                "Origin, X-Requested-With, Content-Type, Accept",
        },
    });
};