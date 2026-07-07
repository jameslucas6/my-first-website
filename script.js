document.getElementById("greet-btn").addEventListener("click", () => {
  document.getElementById("greet-output").textContent = "You just ran your first JavaScript!";
});

async function loadStandings() {
  const status = document.getElementById("pl-table-status");
  const tbody = document.getElementById("pl-table-body");

  try {
    const response = await fetch("/api/standings");
    const standings = await response.json();

    if (!response.ok) {
      throw new Error(standings.error || "Failed to load standings.");
    }

    tbody.innerHTML = standings
      .map(
        (team) => `
          <tr>
            <td>${team.rank}</td>
            <td>${team.team}</td>
            <td>${team.played}</td>
            <td>${team.win}</td>
            <td>${team.draw}</td>
            <td>${team.lose}</td>
            <td>${team.goalsDiff}</td>
            <td>${team.points}</td>
          </tr>
        `
      )
      .join("");

    status.textContent = "";
  } catch (err) {
    status.textContent = "Couldn't load the Premier League table right now.";
  }
}

loadStandings();
