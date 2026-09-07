import { requestUrl, RequestUrlParam } from 'obsidian';

export interface GuildSession {
	_id: string;
	date?: string;
	startDate?: string;
	endDate?: string;
	level?: number;
	maxPlayers: number;
	system: 'PF' | 'DnD';
	location?: string;
	planning?: string;
	worldId?: string;
	attendingCharacters?: string[];
	gmCharacterId?: string;
}

export interface GuildCharacter {
	_id: string;
	name: string;
	lvl: number;
	xp: number;
	ancestry?: string;
	class?: string;
	system?: string;
	userId?: string;
	rank?: string;
	websiteLink?: string;
}

export interface GuildWorld {
	_id: string;
	name: string;
	description?: string;
}

export interface GuildQuest {
	_id: string;
	name: string;
	levelPF?: number;
	levelDnD?: number;
	worldId?: string;
	description?: string;
	questgiver?: string;
	reward?: string;
	tags?: string[];
	owner?: string;
	isCompleted?: boolean;
	characterId?: string;
}

export interface GuildBlackVoidListing {
	_id: string;
	characterId: string;
	type: 'item' | 'service';
	name: string;
	startingBid?: number;
	buyoutPrice?: number;
	durationDays?: number;
	expiresAt?: number;
	status: 'active' | 'completed';
	sellerName?: string;
	sellerLevel?: number;
	description?: string;
	nethysUrl?: string;
}

export interface GuildActivity {
	_id: string;
	title: string;
	timestamp: string;
	type?: string;
}

export class GuildApiClient {
	private baseUrl: string;
	private apiKey: string;

	constructor(baseUrl: string, apiKey: string) {
		this.baseUrl = baseUrl.replace(/\/+$/, '');
		this.apiKey = apiKey.trim();
	}

	private async request<T>(endpoint: string, method: 'GET' | 'POST' | 'PATCH' = 'GET', body?: unknown): Promise<T> {
		const url = `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
		
		const headers: Record<string, string> = {
			'Content-Type': 'application/json'
		};

		if (this.apiKey) {
			headers['Authorization'] = `Bearer ${this.apiKey}`;
		}

		const params: RequestUrlParam = {
			url,
			method,
			headers,
			body: body ? JSON.stringify(body) : undefined
		};

		const res = await requestUrl(params);
		if (res.status >= 400) {
			throw new Error(`API Error [${res.status}]: ${res.text}`);
		}
		return res.json as T;
	}

	// --- Sessions ---
	async getSessions(past?: boolean, worldId?: string, system?: string): Promise<GuildSession[]> {
		const queryParams = new URLSearchParams();
		if (past !== undefined) queryParams.append('past', String(past));
		if (worldId && worldId !== 'ALL') queryParams.append('worldId', worldId);
		if (system) queryParams.append('system', system);
		const qs = queryParams.toString();
		return this.request<GuildSession[]>(`/sessions${qs ? `?${qs}` : ''}`);
	}

	async getSession(sessionId: string): Promise<GuildSession> {
		return this.request<GuildSession>(`/session/${sessionId}`);
	}

	async getSessionCharacters(sessionId: string): Promise<GuildCharacter[]> {
		return this.request<GuildCharacter[]>(`/session/${sessionId}/characters`);
	}

	// --- Characters ---
	async getCharacters(userId?: string): Promise<GuildCharacter[]> {
		const qs = userId ? `?userId=${encodeURIComponent(userId)}` : '';
		return this.request<GuildCharacter[]>(`/characters${qs}`);
	}

	async getCharacter(characterId: string): Promise<GuildCharacter> {
		return this.request<GuildCharacter>(`/character/${characterId}`);
	}

	async createCharacter(data: Partial<GuildCharacter>): Promise<GuildCharacter> {
		return this.request<GuildCharacter>('/character', 'POST', data);
	}

	async updateCharacter(characterId: string, data: Partial<GuildCharacter>): Promise<GuildCharacter> {
		return this.request<GuildCharacter>(`/character/${characterId}`, 'PATCH', data);
	}

	// --- Worlds & Quests ---
	async getWorlds(): Promise<GuildWorld[]> {
		return this.request<GuildWorld[]>('/worlds');
	}

	async getWorld(worldId: string): Promise<GuildWorld> {
		return this.request<GuildWorld>(`/world/${worldId}`);
	}

	async getQuests(worldId?: string): Promise<GuildQuest[]> {
		const endpoint = worldId && worldId !== 'ALL' ? `/world/${worldId}/quests` : '/quests';
		return this.request<GuildQuest[]>(endpoint);
	}

	async createQuest(data: Partial<GuildQuest>): Promise<GuildQuest> {
		return this.request<GuildQuest>('/quest', 'POST', data);
	}

	async updateQuest(questId: string, data: Partial<GuildQuest>): Promise<GuildQuest> {
		return this.request<GuildQuest>(`/quest/${questId}`, 'PATCH', data);
	}

	// --- The Black Void ---
	async getListings(type?: 'item' | 'service', status?: 'active' | 'completed'): Promise<GuildBlackVoidListing[]> {
		const queryParams = new URLSearchParams();
		if (type) queryParams.append('type', type);
		if (status) queryParams.append('status', status);
		const qs = queryParams.toString();
		return this.request<GuildBlackVoidListing[]>(`/black-void/listings${qs ? `?${qs}` : ''}`);
	}

	async createItemListing(data: Partial<GuildBlackVoidListing>): Promise<GuildBlackVoidListing> {
		return this.request<GuildBlackVoidListing>('/black-void/item', 'POST', data);
	}

	async placeBid(listingId: string, characterId: string, amount: number, isBuyout: boolean): Promise<unknown> {
		return this.request('/black-void/bid', 'POST', { listingId, characterId, amount, isBuyout });
	}

	// --- Discovery & Search ---
	async search(query: string): Promise<{ worlds?: GuildWorld[]; characters?: GuildCharacter[] }> {
		return this.request<{ worlds?: GuildWorld[]; characters?: GuildCharacter[] }>(`/search?q=${encodeURIComponent(query)}`);
	}

	async getActivity(limit = 10): Promise<GuildActivity[]> {
		return this.request<GuildActivity[]>(`/activity?limit=${limit}`);
	}
}
