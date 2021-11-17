export function createTeamIndex() {
    const teams = new Map<string, number>();
    return {
        getOrAdd: (team: string) => {
            if (!teams.has(team)) {
                const size = teams.size;
                teams.set(team, size);
            }
            return teams.get(team);
        },
    };
}
