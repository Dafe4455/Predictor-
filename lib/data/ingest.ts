export async function ingestLeagues(): Promise<number> {
  const leaguesData = await apiFetch("/leagues");

  let count = 0;
  for (const item of leaguesData) {
    const league = item.league;
    const country = item.country;

    await db.insert(leagues).values([{
      apiId: String(league.id),
      name: league.name,
      country: country.name,
      countryCode: country.code,
      logo: league.logo,
      flag: country.flag,
      isActive: true,
    }]).onConflictDoUpdate({
      target: leagues.apiId,
      set: {
        name: league.name,
        country: country.name,
        logo: league.logo,
        flag: country.flag,
      },
    });
    count++;
  }

  return count;
}
