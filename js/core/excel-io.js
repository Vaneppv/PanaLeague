import db from "../db.js";

function getXLSX() {
  if (typeof XLSX === "undefined" || !XLSX.SSF) {
    throw new Error("SheetJS (XLSX) no está cargado. Agrega el script CDN en index.html");
  }
  return XLSX;
}

function safeFilename(name) {
  return (name || "plantilla").replace(/[^a-zA-Z0-9_-]+/g, "-").toLowerCase();
}

function calculateAge(fechaNacimiento) {
  if (!fechaNacimiento) return "";
  const today = new Date();
  const birth = new Date(fechaNacimiento);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

async function fetchTeamLogoAsBase64(logoUrl) {
  if (!logoUrl) return null;
  try {
    const response = await fetch(logoUrl);
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(",")[1]);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function exportTeamRoster(teamId) {
  const XLSX = getXLSX();

  const team = await db.getById("teams", Number(teamId));
  if (!team) throw new Error("Equipo no encontrado");

  const leagueId = team.leagueId || db.getActiveLeagueId();
  const league = leagueId ? await db.getById("leagues", Number(leagueId)) : null;

  const allPlayers = await db.getByIndex("players", "teamId", team.id);
  const activePlayers = allPlayers.filter((p) => p.activo !== false);
  activePlayers.sort((a, b) => (a.name || "").localeCompare(b.name || "", "es"));

  const wb = XLSX.utils.book_new();

  const headerData = [
    ["", "", "", "PLANTILLA DE JUGADORES"],
    ["Liga:", league?.name || "", "", ""],
    ["Equipo:", team.name || "", "", ""],
    ["Temporada:", league?.temporada || "", "", ""],
    ["Fecha exportación:", new Date().toLocaleDateString("es-ES"), "", ""],
    ["", "", "", ""],
  ];

  const columns = [
    { key: "number", header: "#" },
    { key: "name", header: "Nombre" },
    { key: "cedula", header: "Cédula" },
    { key: "fechaNacimiento", header: "Fecha Nac." },
    { key: "position", header: "Posición" },
    { key: "number", header: "Número" },
    { key: "activo", header: "Activo" },
  ];

  const rows = activePlayers.map((p, idx) => ({
    "#": idx + 1,
    "Nombre": p.name || "",
    "Cédula": p.cedula || "",
    "Fecha Nac.": p.fechaNacimiento || "",
    "Posición": p.position || "",
    "Número": p.number || "",
    "Activo": p.activo !== false ? "Sí" : "No",
  }));

  const wsData = [...headerData, columns.map((c) => c.header), ...rows.map((r) => columns.map((c) => r[c.header]))];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  const logoBase64 = await fetchTeamLogoAsBase64(team.escudo);
  if (logoBase64) {
    try {
      const imageId = wb.addImage({ base64: logoBase64, extension: team.escudo?.includes(".png") ? "png" : "jpeg" });
      ws["!images"] = [{ type: "image", id: imageId, position: { type: "oneCell", cell: "A1", w: 120, h: 120 } }];
    } catch (e) {
      console.warn("No se pudo incrustar el logo en Excel", e);
    }
  }

  const headerRowCount = headerData.length;
  const headerRange = XLSX.utils.decode_range(ws["!ref"]);
  for (let C = headerRange.s.c; C <= headerRange.e.c; C++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: C });
    if (!ws[cellAddress]) continue;
    ws[cellAddress].s = {
      font: { bold: true, sz: 14, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: team.colorPrincipal?.replace("#", "") || "6C5CE7" } },
      alignment: { horizontal: "center", vertical: "center" },
    };
  }

  for (let r = 1; r < headerRowCount; r++) {
    for (let C = headerRange.s.c; C <= headerRange.e.c; C++) {
      const cellAddress = XLSX.utils.encode_cell({ r, c: C });
      if (!ws[cellAddress]) continue;
      ws[cellAddress].s = {
        font: { bold: r === 1 || r === 2 },
        fill: { fgColor: { rgb: "F2F2F2" } },
      };
    }
  }

  const colWidths = [5, 30, 20, 15, 20, 10, 10];
  ws["!cols"] = colWidths.map((w) => ({ wch: w }));

  const teamColor = team.colorPrincipal?.replace("#", "") || "6C5CE7";
  const headerRowIdx = headerRowCount;
  const range = XLSX.utils.decode_range(ws["!ref"]);
  for (let C = range.s.c; C <= range.e.c; C++) {
    const cellAddress = XLSX.utils.encode_cell({ r: headerRowIdx, c: C });
    if (!ws[cellAddress]) continue;
    ws[cellAddress].s = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: teamColor } },
      alignment: { horizontal: "center" },
      border: {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" },
      },
    };
  }

  for (let R = headerRowIdx + 1; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[cellAddress]) continue;
      ws[cellAddress].s = {
        border: {
          top: { style: "thin", color: { rgb: "CCCCCC" } },
          bottom: { style: "thin", color: { rgb: "CCCCCC" } },
          left: { style: "thin", color: { rgb: "CCCCCC" } },
          right: { style: "thin", color: { rgb: "CCCCCC" } },
        },
      };
    }
  }

  XLSX.utils.book_append_sheet(wb, ws, safeFilename(team.name).substring(0, 31));

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `plantilla-${safeFilename(team.name)}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function parseExcelDate(value) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().split("T")[0];
  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      return `${date.y}-${String(date.m).padStart(2, "0")}-${String(date.d).padStart(2, "0")}`;
    }
  }
  if (typeof value === "string") {
    const parts = value.split(/[\/\-\.]/);
    if (parts.length === 3) {
      const [d, m, y] = parts[2].length === 4 ? [parts[0], parts[1], parts[2]] : [parts[2], parts[1], parts[0]];
      if (y.length === 4 && m.length <= 2 && d.length <= 2) {
        return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
      }
    }
  }
  return "";
}

export async function importTeamRoster(teamId, file) {
  const XLSX = getXLSX();

  const team = await db.getById("teams", Number(teamId));
  if (!team) throw new Error("Equipo no encontrado");

  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  let headerRowIdx = -1;
  for (let i = 0; i < json.length; i++) {
    const row = json[i];
    if (row.includes("Nombre") && row.includes("Cédula")) {
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx === -1) {
    throw new Error("No se encontró la fila de encabezados (Nombre, Cédula, etc.)");
  }

  const headers = json[headerRowIdx];
  const nameIdx = headers.indexOf("Nombre");
  const cedulaIdx = headers.indexOf("Cédula");
  const fechaIdx = headers.indexOf("Fecha Nac.");
  const posicionIdx = headers.indexOf("Posición");
  const numeroIdx = headers.indexOf("Número");
  const activoIdx = headers.indexOf("Activo");

  if (nameIdx === -1) {
    throw new Error("Columna 'Nombre' es requerida");
  }

  const existingPlayers = await db.getByIndex("players", "teamId", team.id);
  const byCedula = {};
  existingPlayers.forEach((p) => {
    if (p.cedula) byCedula[p.cedula.toLowerCase()] = p;
  });

  const results = { created: 0, updated: 0, errors: [] };

  for (let i = headerRowIdx + 1; i < json.length; i++) {
    const row = json[i];
    if (!row || row.every((c) => !c)) continue;

    const name = (row[nameIdx] || "").toString().trim();
    if (!name) {
      results.errors.push({ row: i + 1, error: "Nombre vacío" });
      continue;
    }

    const cedula = (row[cedulaIdx] || "").toString().trim();
    const fechaNacimiento = parseExcelDate(row[fechaIdx]);
    const position = (row[posicionIdx] || "").toString().trim();
    const number = row[numeroIdx] ? Number(row[numeroIdx]) : null;
    const activo = activoIdx !== -1 ? (row[activoIdx] || "").toString().trim().toLowerCase() !== "no" : true;

    const playerData = {
      name,
      cedula,
      fechaNacimiento,
      position,
      number,
      teamId: team.id,
      activo,
    };

    try {
      if (cedula && byCedula[cedula.toLowerCase()]) {
        const existing = byCedula[cedula.toLowerCase()];
        await db.put("players", { ...existing, ...playerData });
        results.updated++;
      } else {
        const newId = await db.add("players", playerData);
        if (cedula) byCedula[cedula.toLowerCase()] = { ...playerData, id: newId };
        results.created++;
      }
    } catch (err) {
      results.errors.push({ row: i + 1, error: err.message });
    }
  }

  return results;
}

export async function exportLeagueTemplate(leagueId) {
  const XLSX = getXLSX();

  const league = await db.getById("leagues", leagueId);
  if (!league) throw new Error("Liga no encontrada");

  const teams = await db.getByIndex("teams", "leagueId", leagueId);

  const wb = XLSX.utils.book_new();

  for (const team of teams) {
    const allPlayers = await db.getByIndex("players", "teamId", team.id);
    const activePlayers = allPlayers.filter((p) => p.activo !== false);
    activePlayers.sort((a, b) => (a.name || "").localeCompare(b.name || "", "es"));

    const wsData = [
      ["", "", "", "PLANTILLA DE JUGADORES"],
      ["Liga:", league.name || "", "", ""],
      ["Equipo:", team.name || "", "", ""],
      ["Temporada:", league.temporada || "", "", ""],
      ["Fecha exportación:", new Date().toLocaleDateString("es-ES"), "", ""],
      ["", "", "", ""],
      ["#", "Nombre", "Cédula", "Fecha Nac.", "Posición", "Número", "Activo"],
      ...activePlayers.map((p, idx) => [
        idx + 1,
        p.name || "",
        p.cedula || "",
        p.fechaNacimiento || "",
        p.position || "",
        p.number || "",
        p.activo !== false ? "Sí" : "No",
      ]),
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);

    const colWidths = [5, 30, 20, 15, 20, 10, 10];
    ws["!cols"] = colWidths.map((w) => ({ wch: w }));

    XLSX.utils.book_append_sheet(wb, ws, safeFilename(team.name).substring(0, 31));
  }

  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `plantilla-liga-${safeFilename(league.name)}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}