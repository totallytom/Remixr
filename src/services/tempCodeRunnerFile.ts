console.log(`[AUTH DEBUG] Event: ${event} | UserID: ${session?.user?.id} | HasCache: ${!!this.getCachedProfile(session?.user?.id || '')}`);
