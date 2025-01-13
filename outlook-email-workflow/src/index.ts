import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';

interface Env {
	EMAIL_WORKFLOW: any; // We'll define this type properly later
	OUTLOOK_CLIENT_ID: string;
	OUTLOOK_CLIENT_SECRET: string;
	OUTLOOK_TENANT_ID: string;
	DEFAULT_EMAIL: string; // Add this to store the default email to check
	// Add KV binding for storing tokens
	OUTLOOK_TOKENS: KVNamespace;
}

interface EmailWorkflowParams {
	userEmail: string;
	folderId?: string;
	since?: string;
}

interface GraphApiResponse {
	value: any[];
	'@odata.nextLink'?: string;
	'@odata.deltaLink'?: string;
}

interface TokenResponse {
	access_token: string;
	expires_in: number;
	token_type: string;
	refresh_token: string;
}

interface EmailsResponse {
	messages: any[];
	nextLink?: string;
	deltaLink?: string;
}

export class OutlookEmailWorkflow extends WorkflowEntrypoint<Env, EmailWorkflowParams> {
	async run(event: WorkflowEvent<EmailWorkflowParams>, step: WorkflowStep) {
		// Step 1: Get or refresh access token
		console.log('Getting Microsoft Graph API access token');
		const token = await step.do<TokenResponse>('get-ms-graph-token', async () => {
			// Try to get existing refresh token
			const refreshToken = await this.env.OUTLOOK_TOKENS.get('refresh_token');
			if (!refreshToken) {
				throw new Error('No refresh token found. Please authenticate first at /auth');
			}

			const tokenEndpoint = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/token';
			
			const response = await fetch(tokenEndpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: new URLSearchParams({
					client_id: this.env.OUTLOOK_CLIENT_ID,
					client_secret: this.env.OUTLOOK_CLIENT_SECRET,
					refresh_token: refreshToken,
					grant_type: 'refresh_token',
				}),
			});

			if (!response.ok) {
				const errorData = await response.text();
				console.error('Token refresh failed:', errorData);
				throw new Error(`Failed to refresh token: ${errorData}`);
			}

			const tokenData = await response.json() as TokenResponse;
			
			// Store new refresh token
			await this.env.OUTLOOK_TOKENS.put('refresh_token', tokenData.refresh_token);
			
			return tokenData;
		});

		// Step 2: Fetch emails using /me endpoint
		const emails = await step.do<EmailsResponse>('fetch-emails', async () => {
			// Remove the time filter to get all emails
			let allMessages: any[] = [];
			let nextLink: string | undefined = `https://graph.microsoft.com/v1.0/me/messages?${new URLSearchParams({
				'$orderby': 'receivedDateTime desc',
				'$select': 'id,subject,receivedDateTime,from,bodyPreview,isRead',
				'$top': '50'
			})}`;

			while (nextLink) {
				console.log('Fetching from:', nextLink); // Add debug logging
				const response = await fetch(nextLink, {
					headers: {
						'Authorization': `Bearer ${token.access_token}`,
						'Content-Type': 'application/json'
					},
				});

				if (!response.ok) {
					const errorData = await response.text();
					console.error('Failed to fetch emails:', errorData);
					throw new Error(`Failed to fetch emails: ${errorData}`);
				}

				const data = await response.json() as GraphApiResponse;
				allMessages = allMessages.concat(data.value);
				nextLink = data['@odata.nextLink'];
				
				console.log(`Retrieved ${data.value.length} messages, total: ${allMessages.length}`);
			}
			
			return {
				messages: allMessages,
				deltaLink: undefined
			};
		});

		return emails;
	}
}

// HTTP handler to trigger the workflow
export default {
	async fetch(req: Request, env: Env): Promise<Response> {
		const url = new URL(req.url);
		const path = url.pathname;

		// Auth endpoints for initial setup
		if (path === '/auth') {
			const authUrl = `https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?` +
				new URLSearchParams({
					client_id: env.OUTLOOK_CLIENT_ID,
					response_type: 'code',
					redirect_uri: `${url.origin}/auth/callback`,
					scope: 'offline_access Mail.Read',
					response_mode: 'query'
				});

			return Response.redirect(authUrl);
		}

		if (path === '/auth/callback') {
			const code = url.searchParams.get('code');
			if (!code) {
				return new Response('Missing code', { status: 400 });
			}

			// Exchange code for tokens
			const tokenResponse = await fetch('https://login.microsoftonline.com/consumers/oauth2/v2.0/token', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
				},
				body: new URLSearchParams({
					client_id: env.OUTLOOK_CLIENT_ID,
					client_secret: env.OUTLOOK_CLIENT_SECRET,
					code,
					redirect_uri: `${url.origin}/auth/callback`,
					grant_type: 'authorization_code',
				}),
			});

			const tokens = await tokenResponse.json() as TokenResponse;
			
			// Store refresh token
			await env.OUTLOOK_TOKENS.put('refresh_token', tokens.refresh_token);
			
			return new Response('Authentication successful! You can now close this window.');
		}

		const id = url.searchParams.get('instanceId');

		// Get status of existing instance
		if (id) {
			const instance = await env.EMAIL_WORKFLOW.get(id);
			return Response.json({
				status: await instance.status(),
			});
		}

		// Require email parameter
		const userEmail = url.searchParams.get('email');
		if (!userEmail) {
			return new Response('Missing required parameter: email', { status: 400 });
		}

		// Create new workflow instance
		const params: EmailWorkflowParams = {
			userEmail,
			since: url.searchParams.get('since') || undefined,
		};

		const instance = await env.EMAIL_WORKFLOW.create({
			params
		});

		return Response.json({
			id: instance.id,
			details: await instance.status(),
		});
	},

	// Add scheduled handler to run every 15 minutes
	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		console.log('Running scheduled email check');
		
		// Create new workflow instance with default email
		const instance = await env.EMAIL_WORKFLOW.create({
			params: {
				userEmail: env.DEFAULT_EMAIL,
				// Look back 16 minutes to ensure we don't miss any emails
				// due to slight timing differences
				since: new Date(Date.now() - 16 * 60 * 1000).toISOString()
			}
		});

		console.log(`Created scheduled workflow instance: ${instance.id}`);
	}
};
