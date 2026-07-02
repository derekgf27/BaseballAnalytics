-- Rename our club from the previous default to New York Mets (home/away column depends on our_side).
update public.games
set home_team = 'New York Mets'
where our_side = 'home'
  and home_team = 'Reyes de Juana Diaz';

update public.games
set away_team = 'New York Mets'
where our_side = 'away'
  and away_team = 'Reyes de Juana Diaz';
