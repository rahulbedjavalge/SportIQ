// @ts-nocheck
// lib/sql.ts
// Use the browser build of sql.js and load the wasm from /public

import initSqlJs from "sql.js/dist/sql-wasm.js";

export async function initDb(seedSql: string): Promise<SQL.Database> {
  // Tell sql.js where to fetch the wasm file that you just copied to /public
  const SQL = await initSqlJs({
    locateFile: () => "/sql-wasm.wasm"
  });
  const db = new SQL.Database();
  db.run(seedSql);
  return db;
}

function findTeam(db: SQL.Database, text: string): string | null {
  const t = text.toLowerCase();
  const res = db.exec("SELECT name, alias1, alias2 FROM teams;");
  if (!res.length) return null;
  const { columns, values } = res[0];
  for (const row of values) {
    const r: any = {};
    columns.forEach((c, i) => (r[c] = row[i]));
    if ([r.name, r.alias1, r.alias2].some((x: string) => x && t.includes(x))) return r.name;
  }
  return null;
}

export function queryByIntent(db: SQL.Database, intent: string, text: string): string {
  const team = findTeam(db, text);

  switch (intent) {
    case "today_fixtures": {
      const res = db.exec(`SELECT home, away, stadium, city FROM matches WHERE is_today = 1;`);
      return rowsToLines(res, r => `${r.home} vs ${r.away} at ${r.stadium}, ${r.city}`) || "No fixtures today in the mock data.";
    }
    case "latest_score": {
      if (!team) return "Which team do you mean?";
      const res = db.exec(
        `SELECT home, away, home_goals, away_goals, date
         FROM matches
         WHERE lower(home)=:t OR lower(away)=:t
         ORDER BY date DESC LIMIT 1;`,
        { ":t": team }
      );
      return rowsToLines(res, r => `${r.home} ${r.home_goals} - ${r.away_goals} ${r.away} on ${r.date}`) || "No recent match found.";
    }
    case "goal_scorers": {
      if (!team) return "For which team?";
      const res = db.exec(
        `SELECT g.scorer, g.minute
         FROM goals g
         JOIN matches m ON m.id = g.match_id
         WHERE lower(g.team) = :t
         ORDER BY m.date DESC, g.minute;`,
        { ":t": team }
      );
      return rowsToLines(res, r => `${r.scorer} (${r.minute}')`) || "No goal data found.";
    }
    case "stadium_location": {
  const t = findTeam(db, text);
  if (t) {
    const res = db.exec(
      `SELECT stadium, city, home, away, date
       FROM matches
       WHERE lower(home)=:t OR lower(away)=:t
       ORDER BY date DESC LIMIT 1;`,
      { ":t": t }
    );
    return rowsToLines(res, r => `${r.stadium}, ${r.city} for ${r.home} vs ${r.away} on ${r.date}`) || "No stadium info found.";
  }
  // no team detected → ask for disambiguation
  return "Which team or match do you mean? Try: where was Berlin United’s last match?";
}

    case "sport_type_for_match": {
      if (team) {
        const res = db.exec(
          `SELECT sport, home, away, date
           FROM matches WHERE lower(home)=:t OR lower(away)=:t
           ORDER BY date DESC LIMIT 1;`,
          { ":t": team }
        );
        return rowsToLines(res, r => `${r.home} vs ${r.away} is ${r.sport} (${r.date})`) || "No sport type found.";
      } else {
        const res = db.exec(`SELECT sport, home, away, date FROM matches ORDER BY date DESC LIMIT 1;`);
        return rowsToLines(res, r => `${r.home} vs ${r.away} is ${r.sport} (${r.date})`);
      }
    }
    case "upcoming_for_team": {
      if (!team) return "Which team?";
      const res = db.exec(
        `SELECT date, kickoff, home, away, stadium, city
         FROM matches
         WHERE (lower(home)=:t OR lower(away)=:t) AND home_goals IS NULL AND away_goals IS NULL
         ORDER BY date ASC LIMIT 1;`,
        { ":t": team }
      );
      return rowsToLines(res, r => `Next: ${r.home} vs ${r.away} on ${r.date} ${r.kickoff} at ${r.stadium}, ${r.city}`) || "No upcoming match found.";
    }
    case "last_match_for_team": {
      if (!team) return "Which team?";
      const res = db.exec(
        `SELECT date, home, away, home_goals, away_goals, stadium
         FROM matches
         WHERE (lower(home)=:t OR lower(away)=:t) AND home_goals IS NOT NULL
         ORDER BY date DESC LIMIT 1;`,
        { ":t": team }
      );
      return rowsToLines(res, r => `Last: ${r.home} ${r.home_goals}-${r.away_goals} ${r.away} at ${r.stadium} on ${r.date}`) || "No last match found.";
    }
    case "top_scorer_team": {
      if (!team) return "Which team?";
      const res = db.exec(
        `SELECT scorer, COUNT(*) as goals
         FROM goals WHERE lower(team)=:t
         GROUP BY scorer ORDER BY goals DESC LIMIT 1;`,
        { ":t": team }
      );
      return rowsToLines(res, r => `Top scorer: ${r.scorer} with ${r.goals}`) || "No scorers found.";
    }
    case "tournament_info": {
      const res = db.exec(`SELECT name, season FROM tournaments LIMIT 5;`);
      return rowsToLines(res, r => `${r.name} ${r.season}`);
    }
    case "help":
      return "I can answer: today’s fixtures, latest score, goal scorers, stadium and city, sport type, upcoming, last match, top scorer, and tournament info.";
    default:
      return "Sorry, I could not map that to one of my 10 questions.";
  }
}

function rowsToLines(execRes: SQL.QueryExecResult[], fmt: (r: any) => string): string {
  if (!execRes.length || !execRes[0].values.length) return "";
  const r0 = execRes[0];
  return r0.values
    .map(v => {
      const row: any = {};
      r0.columns.forEach((c, i) => (row[c] = v[i]));
      return fmt(row);
    })
    .join("\n");
}
