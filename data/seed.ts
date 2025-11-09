const seedSQL = `
-- tournaments
CREATE TABLE tournaments (id INTEGER PRIMARY KEY, name TEXT, season TEXT, winner TEXT);
INSERT INTO tournaments (name, season, winner) VALUES
("Bundes Mock Cup", "2025/26", "Berlin United"),
("City League", "2025", "Munich City");

-- matches
CREATE TABLE matches (
  id INTEGER PRIMARY KEY,
  date TEXT,
  kickoff TEXT,
  home TEXT,
  away TEXT,
  stadium TEXT,
  city TEXT,
  sport TEXT,
  home_goals INTEGER,
  away_goals INTEGER,
  is_today INTEGER DEFAULT 0
);

INSERT INTO matches (date, kickoff, home, away, stadium, city, sport, home_goals, away_goals, is_today) VALUES
("2025-11-08","18:30","Berlin United","Munich City","Olympia Park","Berlin","football",2,1,1),
("2025-11-09","20:00","Hamburg FC","Berlin United","Harbor Arena","Hamburg","football",1,1,0),
("2025-11-05","19:00","Munich City","Hamburg FC","Allianz Field","Munich","football",3,2,0),
("2025-11-12","19:30","Berlin United","Hamburg FC","Olympia Park","Berlin","football",NULL,NULL,0);

-- goals
CREATE TABLE goals (
  id INTEGER PRIMARY KEY,
  match_id INTEGER,
  team TEXT,
  scorer TEXT,
  minute INTEGER
);
INSERT INTO goals (match_id, team, scorer, minute) VALUES
(1, "berlin united", "A. Richter", 41),
(1, "munich city", "J. Mendes", 53),
(1, "berlin united", "K. Hofmann", 77),
(3, "munich city", "L. Bauer", 9),
(3, "munich city", "M. Ortega", 55),
(3, "hamburg fc", "S. Brandt", 64),
(3, "munich city", "H. Novak", 80),
(2, "berlin united", "M. Vogel", 72),
(2, "hamburg fc", "D. Keller", 68);

-- team aliases for simple entity detection
CREATE TABLE teams (name TEXT PRIMARY KEY, alias1 TEXT, alias2 TEXT);
INSERT INTO teams VALUES
("berlin united", "berlin", "bu"),
("munich city", "munich", "mc"),
("hamburg fc", "hamburg", "hfc");
`;
export default seedSQL;
