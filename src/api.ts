import { requestUrl, RequestUrlParam } from 'obsidian';

export interface GuildInGameDate {
	day?: number;
	month?: number;
	year?: number;
	endDay?: number;
	endMonth?: number;
	endYear?: number;
	era?: string;
}

export interface GuildCalendarEra {
	name: string;
	abbreviation?: string;
	date: {
		year: number;
		timespan?: number;
		month?: number;
		day?: number;
		epoch?: number;
	};
	settings?: {
		restart?: boolean;
		starting_era?: boolean;
		ends_year?: boolean;
		use_custom_format?: boolean;
		[key: string]: unknown;
	};
	formatting?: string;
	description?: string;
}

export interface GuildCalendarMonth {
	name: string;
	length: number;
	type?: string;
}

export interface GuildCalendar {
	name?: string;
	dynamic_data?: {
		year?: number;
		month?: number;
		timespan?: number;
		day?: number;
		current_era?: number;
		[key: string]: unknown;
	};
	static_data?: {
		eras?: GuildCalendarEra[];
		year_data?: {
			first_day?: number;
			timespans?: GuildCalendarMonth[];
			[key: string]: unknown;
		};
		[key: string]: unknown;
	};
}

export interface GuildWorldCalendarResponse {
	name?: string;
	calendar?: GuildCalendar;
	[key: string]: unknown;
}

export interface GuildSessionLoot {
	id?: string;
	name: string;
	valueGP: number;
	isGood: boolean;
	isPerCharacter?: boolean;
	claimedBy?: string;
	claimedByCharacters?: string[];
	link?: string;
	quantity?: number;
}

export interface GuildSessionQuote {
	_id?: string;
	sessionId?: string;
	characterId?: string;
	characterName?: string;
	quote: string;
	[key: string]: unknown;
}

export interface GuildSessionState {
	initiative?: Array<{ id: string; name: string; counter?: number; [key: string]: unknown }>;
	currentIndex?: number;
	round?: number;
	timeSeconds?: number;
	isClockRunning?: boolean;
	multiplier?: number;
	[key: string]: unknown;
}

export interface GuildSession {
	_id: string;
	date?: string | number;
	startDate?: string;
	endDate?: string;
	inGameDate?: GuildInGameDate;
	level?: number;
	maxPlayers: number;
	system: 'PF' | 'DnD';
	location?: string;
	planning?: string | boolean;
	isPrivate?: boolean;
	isIntro?: boolean;
	locked?: boolean;
	worldId?: string;
	world_id?: string;
	worldName?: string;
	world?: string | { _id?: string; name?: string };
	owner?: string;
	characters?: string[];
	attendingCharacters?: string[];
	gmCharacterId?: string;
	voidContribution?: number;
	pendingVoidContribution?: number;
	loot?: GuildSessionLoot[];
}

export interface GuildCharacterHitPoints {
	max: number;
	current: number;
	temporary?: number;
	ancestryHP?: number;
	classHP?: number;
	bonusHP?: number;
}

export interface GuildCharacterArmorClass {
	total: number;
	shieldBonus?: number;
	equippedArmorName?: string;
}

export interface GuildCharacterSave {
	bonus: number;
	proficiency?: string;
}

export interface GuildCharacterSkill {
	name: string;
	bonus: number;
	proficiency?: string;
	isLore?: boolean;
}

export interface GuildCharacterMoney {
	cp?: number;
	sp?: number;
	gp?: number;
	pp?: number;
	totalInGold?: number;
}

export interface GuildCharacterCondition {
	name: string;
	value?: number;
}

export interface GuildCharacterSheetDetails {
	_id?: string;
	characterId?: string;
	system?: string;
	abilities?: {
		str?: number;
		dex?: number;
		con?: number;
		int?: number;
		wis?: number;
		cha?: number;
		[key: string]: number | undefined;
	};
	hitPoints?: GuildCharacterHitPoints;
	armorClass?: GuildCharacterArmorClass;
	saves?: {
		fortitude?: GuildCharacterSave;
		reflex?: GuildCharacterSave;
		will?: GuildCharacterSave;
		perception?: GuildCharacterSave;
		[key: string]: GuildCharacterSave | undefined;
	};
	skills?: Record<string, GuildCharacterSkill>;
	money?: GuildCharacterMoney;
	conditions?: GuildCharacterCondition[];
	gear?: unknown[];
	buildSummary?: unknown;
	[key: string]: unknown;
}

export interface GuildCharacter {
	_id: string;
	name: string;
	title?: string;
	lvl: number;
	xp: number;
	ancestry?: string;
	class?: string;
	system?: string;
	userId?: string;
	rank?: string;
	websiteLink?: string;
	player?: any;
	playerName?: any;
	user_name?: any;
	userName?: any;
	username?: any;
	ownerName?: any;
	displayName?: any;
	details?: GuildCharacterSheetDetails;
	reputation?: any;
	reputations?: any;
	factions?: any;
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
	rewardType?: 'party' | 'per_person';
	rewardMoneyGP?: number;
	rewardOther?: string;
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
	priceType?: string;
	percentage?: number;
	markupGp?: number;
	priceDetails?: string;
	minLevel?: number;
	maxLevel?: number;
}

export interface GuildActivity {
	_id: string;
	title: string;
	timestamp: string;
	type?: string;
}

export interface GuildReputationEntry {
	characterId?: string;
	factionName?: string;
	score?: number;
	delta?: number;
	[key: string]: unknown;
}

export class GuildApiClient {
	private baseUrl: string;
	private apiKey: string;

	constructor(baseUrl: string, apiKey: string) {
		this.baseUrl = baseUrl.replace(/\/+$/, '');
		this.apiKey = apiKey.trim();
	}

	private async request<T>(
		endpoint: string,
		method: 'GET' | 'POST' | 'PATCH' = 'GET',
		body?: unknown,
		includeAuth = true
	): Promise<T> {
		if ((method === 'POST' || method === 'PATCH') && !this.apiKey) {
			throw new Error('API Key missing. Please configure your API key in Guild Obsidian settings.');
		}

		let url: string;
		if (endpoint.startsWith('/api/') && this.baseUrl.endsWith('/api/external/v1')) {
			const root = this.baseUrl.replace(/\/api\/external\/v1\/?$/, '');
			url = `${root}${endpoint}`;
		} else {
			url = `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
		}

		const headers: Record<string, string> = {
			'Content-Type': 'application/json'
		};

		if (this.apiKey && includeAuth) {
			headers['Authorization'] = `Bearer ${this.apiKey}`;
		}

		const params: RequestUrlParam = {
			url,
			method,
			headers,
			body: body ? JSON.stringify(body) : undefined,
			throw: false
		};

		const res = await requestUrl(params);
		if (res.status >= 400) {
			let detail = res.text;
			try {
				const jsonErr = res.json as Record<string, unknown>;
				if (jsonErr && (jsonErr.message || jsonErr.error)) {
					detail = String(jsonErr.message || jsonErr.error);
				}
			} catch {
				// use raw text
			}

			if (res.status === 401) {
				throw new Error(`Unauthorized [401]: ${detail || 'Invalid or missing API Key'}`);
			} else if (res.status === 403) {
				throw new Error(`Forbidden [403]: ${detail || 'API Key lacks required permissions for this action'}`);
			}
			throw new Error(`API Error [${res.status}]: ${detail}`);
		}
		return res.json as T;
	}

	// --- Sessions ---
	async getSessions(past?: boolean, worldId?: string, system?: string, isIntro?: boolean): Promise<GuildSession[]> {
		const queryParams = new URLSearchParams();
		if (past !== undefined) queryParams.append('past', String(past));
		if (isIntro !== undefined) queryParams.append('isIntro', String(isIntro));
		if (worldId && worldId !== 'ALL') queryParams.append('worldId', worldId);
		if (system) queryParams.append('system', system);
		const qs = queryParams.toString();
		try {
			return await this.request<GuildSession[]>(`/sessions${qs ? `?${qs}` : ''}`);
		} catch (err) {
			// Fallback: if server requires system filter, query both systems in parallel
			if (!system) {
				const [pf, dnd] = await Promise.all([
					this.getSessions(past, worldId, 'PF', isIntro).catch(() => []),
					this.getSessions(past, worldId, 'DnD', isIntro).catch(() => [])
				]);
				if (pf.length > 0 || dnd.length > 0) {
					const map = new Map<string, GuildSession>();
					for (const s of [...pf, ...dnd]) {
						map.set(s._id, s);
					}
					const getDateNum = (d: unknown) => {
						if (typeof d === 'number') return d;
						if (typeof d === 'string') {
							const t = new Date(d).getTime();
							return isNaN(t) ? 0 : t;
						}
						return 0;
					};
					return Array.from(map.values()).sort((a, b) => getDateNum(b.date) - getDateNum(a.date));
				}
			}
			throw err;
		}
	}

	async getSession(sessionId: string): Promise<GuildSession> {
		return this.request<GuildSession>(`/session/${sessionId}`);
	}

	async getSessionCharacters(sessionId: string): Promise<GuildCharacter[]> {
		return this.request<GuildCharacter[]>(`/session/${sessionId}/characters`);
	}

	async getSessionQuotes(sessionId: string): Promise<GuildSessionQuote[]> {
		return this.request<GuildSessionQuote[]>(`/session/${sessionId}/quotes`);
	}

	async getSessionState(sessionId: string): Promise<GuildSessionState> {
		return this.request<GuildSessionState>(`/session/${sessionId}/state`);
	}

	async createSession(data: Partial<GuildSession>): Promise<GuildSession> {
		return this.request<GuildSession>('/session', 'POST', data);
	}

	async updateSession(sessionId: string, data: Partial<GuildSession>): Promise<GuildSession> {
		return this.request<GuildSession>(`/session/${sessionId}`, 'PATCH', data);
	}

	async addSessionLoot(sessionId: string, loot: GuildSessionLoot): Promise<unknown> {
		return this.request(`/session/${sessionId}/loot`, 'POST', loot);
	}

	async submitCommendation(sessionId: string, toCharacterId: string, category: string): Promise<unknown> {
		return this.request(`/session/${sessionId}/commendation`, 'POST', { toCharacterId, category });
	}

	async updateSessionState(sessionId: string, state: GuildSessionState): Promise<GuildSessionState> {
		return this.request<GuildSessionState>(`/session/${sessionId}/state`, 'PATCH', state);
	}

	// --- Characters ---
	async getCharacters(userId?: string): Promise<GuildCharacter[]> {
		const qs = userId ? `?userId=${encodeURIComponent(userId)}` : '';
		// GET /characters is public; omitting Authorization returns all characters across the guild
		return this.request<GuildCharacter[]>(`/characters${qs}`, 'GET', undefined, false);
	}

	async getCharacter(characterId: string): Promise<GuildCharacter> {
		return this.request<GuildCharacter>(`/character/${characterId}`);
	}

	async getCharacterSheet(characterId: string): Promise<GuildCharacterSheetDetails | unknown> {
		return this.request<GuildCharacterSheetDetails | unknown>(`/character/${characterId}/sheet`);
	}

	async createCharacter(data: Partial<GuildCharacter>): Promise<GuildCharacter> {
		return this.request<GuildCharacter>('/character', 'POST', data);
	}

	async createCharacterSheet(characterId: string, data: unknown): Promise<unknown> {
		return this.request<unknown>(`/character/${characterId}/sheet`, 'POST', data);
	}

	async updateCharacter(characterId: string, data: Partial<GuildCharacter>): Promise<GuildCharacter> {
		return this.request<GuildCharacter>(`/character/${characterId}`, 'PATCH', data);
	}

	async updateCharacterSheet(characterId: string, data: unknown): Promise<unknown> {
		return this.request<unknown>(`/character/${characterId}/sheet`, 'PATCH', data);
	}

	async getPathbuilderExport(exportId: number | string): Promise<unknown> {
		return this.request<unknown>(`/api/pathbuilder?id=${encodeURIComponent(String(exportId))}`);
	}

	// --- Worlds & Quests ---
	async getWorlds(): Promise<GuildWorld[]> {
		return this.request<GuildWorld[]>('/worlds');
	}

	async getWorld(worldId: string): Promise<GuildWorld> {
		return this.request<GuildWorld>(`/world/${worldId}`);
	}

	async getWorldCalendar(worldId: string): Promise<GuildCalendar | null> {
		try {
			const res = await this.request<GuildWorldCalendarResponse>(`/world/${worldId}/calendar`);
			if (res && res.calendar) {
				return res.calendar;
			}
			return (res as unknown as GuildCalendar) || null;
		} catch {
			return null;
		}
	}

	async updateWorldCalendar(worldId: string, date: { year: number; month: number; day: number }): Promise<unknown> {
		return this.request<unknown>(`/world/${worldId}/calendar`, 'PATCH', date);
	}

	async getQuests(worldId?: string): Promise<GuildQuest[]> {
		const endpoint = worldId && worldId !== 'ALL' ? `/world/${worldId}/quests` : '/quests';
		return this.request<GuildQuest[]>(endpoint);
	}

	async getCharacterQuests(characterId?: string): Promise<GuildQuest[]> {
		const qs = characterId ? `?characterId=${encodeURIComponent(characterId)}` : '';
		return this.request<GuildQuest[]>(`/character-quests${qs}`);
	}

	async createQuest(data: Partial<GuildQuest>): Promise<GuildQuest> {
		return this.request<GuildQuest>('/quest', 'POST', data);
	}

	async updateQuest(questId: string, data: Partial<GuildQuest>): Promise<GuildQuest> {
		return this.request<GuildQuest>(`/quest/${questId}`, 'PATCH', data);
	}

	// --- Reputation ---
	async getWorldReputation(worldId: string): Promise<unknown> {
		return this.request<unknown>(`/world/${worldId}/reputation`);
	}

	async updateReputation(worldId: string, characterId: string, factionName: string, delta: number): Promise<unknown> {
		return this.request<unknown>('/reputation', 'PATCH', {
			worldId,
			characterId,
			factionName,
			delta,
			score: delta,
			value: delta
		});
	}

	// --- The Black Void ---
	async getListings(type?: 'item' | 'service', status?: 'active' | 'completed'): Promise<GuildBlackVoidListing[]> {
		const queryParams = new URLSearchParams();
		if (type) queryParams.append('type', type);
		if (status) queryParams.append('status', status);
		const qs = queryParams.toString();
		return this.request<GuildBlackVoidListing[]>(`/black-void/listings${qs ? `?${qs}` : ''}`);
	}

	async getBlackVoidTransactions(characterId: string): Promise<unknown> {
		return this.request<unknown>(`/black-void/character/${characterId}/transactions`);
	}

	async getBlackVoidLog(characterId: string): Promise<unknown> {
		return this.request<unknown>(`/black-void/character/${characterId}/log`);
	}

	async createItemListing(data: Partial<GuildBlackVoidListing>): Promise<GuildBlackVoidListing> {
		return this.request<GuildBlackVoidListing>('/black-void/item', 'POST', data);
	}

	async createServiceListing(data: Partial<GuildBlackVoidListing>): Promise<unknown> {
		return this.request('/black-void/service', 'POST', data);
	}

	async placeBid(listingId: string, characterId: string, amount: number, isBuyout: boolean, maxAutoBid?: number): Promise<unknown> {
		return this.request('/black-void/bid', 'POST', {
			listingId,
			characterId,
			amount,
			isBuyout,
			maxAutoBid
		});
	}

	async claimBlackVoidSeller(listingId: string): Promise<unknown> {
		return this.request('/black-void/claim/seller', 'PATCH', { listingId });
	}

	async claimBlackVoidBuyer(listingId: string): Promise<unknown> {
		return this.request('/black-void/claim/buyer', 'PATCH', { listingId });
	}

	async claimBlackVoidQuest(questId: string, type: 'reimbursement' | 'payment'): Promise<unknown> {
		return this.request('/black-void/claim/quest', 'PATCH', { questId, type });
	}

	async claimBlackVoidGuildmaster(sessionId: string): Promise<unknown> {
		return this.request('/black-void/claim/guildmaster', 'PATCH', { sessionId });
	}

	async claimBlackVoidBet(betId: string, result: 'winner' | 'loser'): Promise<unknown> {
		return this.request(`/black-void/claim/bet/${result}`, 'PATCH', { betId });
	}

	async claimBlackVoidAll(characterId: string): Promise<unknown> {
		return this.request('/black-void/claim/all', 'PATCH', { characterId });
	}

	// --- Availability & Player Schedule ---
	async getAvailability(startDate?: string, endDate?: string): Promise<unknown> {
		const queryParams = new URLSearchParams();
		if (startDate) queryParams.append('startDate', startDate);
		if (endDate) queryParams.append('endDate', endDate);
		const qs = queryParams.toString();
		return this.request<unknown>(`/availability${qs ? `?${qs}` : ''}`);
	}

	async toggleAvailability(date: number | string, isGM: boolean): Promise<unknown> {
		return this.request('/availability', 'POST', { date, isGM });
	}

	// --- Commendations & Achievements ---
	async getCommendations(sessionId?: string, characterId?: string): Promise<unknown> {
		const queryParams = new URLSearchParams();
		if (sessionId) queryParams.append('sessionId', sessionId);
		if (characterId) queryParams.append('characterId', characterId);
		const qs = queryParams.toString();
		return this.request<unknown>(`/commendations${qs ? `?${qs}` : ''}`);
	}

	async getAchievements(): Promise<unknown> {
		return this.request<unknown>('/achievements');
	}

	// --- Discovery & Search ---
	async search(query: string): Promise<{ worlds?: GuildWorld[]; characters?: GuildCharacter[] }> {
		return this.request<{ worlds?: GuildWorld[]; characters?: GuildCharacter[] }>(`/search?q=${encodeURIComponent(query)}`);
	}

	async getActivity(limit = 10): Promise<GuildActivity[]> {
		return this.request<GuildActivity[]>(`/activity?limit=${limit}`);
	}
}
