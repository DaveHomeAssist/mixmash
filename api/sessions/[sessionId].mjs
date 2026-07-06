import { handleNodeRequest } from '../../mars/server.mjs';

export const config = {
  runtime: 'nodejs',
  maxDuration: 10,
};

export default async function handler(request, response) {
  return handleNodeRequest(request, response, { serveStaticFiles: false });
}
