// Mock data simulando datos realistas del sector automotriz
export const KPIS = {
  otsAbiertas: 47,
  otsCerradas: 312,
  repuestosConsumidos: 1849,
  inventarioDisponible: 8420,
  quiebresStock: 12,
  prediccionDemanda: 1342,
};

export const consumoMensual = [
  { mes: "Ene", consumo: 1120, prediccion: 1080 },
  { mes: "Feb", consumo: 980, prediccion: 1010 },
  { mes: "Mar", consumo: 1340, prediccion: 1290 },
  { mes: "Abr", consumo: 1510, prediccion: 1480 },
  { mes: "May", consumo: 1420, prediccion: 1390 },
  { mes: "Jun", consumo: 1680, prediccion: 1620 },
  { mes: "Jul", consumo: 1820, prediccion: 1790 },
  { mes: "Ago", consumo: 1750, prediccion: 1730 },
  { mes: "Sep", consumo: 1640, prediccion: 1660 },
  { mes: "Oct", consumo: 1890, prediccion: 1850 },
  { mes: "Nov", consumo: 1950, prediccion: 1920 },
  { mes: "Dic", consumo: 2100, prediccion: 2050 },
];

export const distribucionServicios = [
  { tipo: "Preventivo", valor: 42 },
  { tipo: "Correctivo", valor: 31 },
  { tipo: "Planchado y Pintura", valor: 17 },
  { tipo: "Embellecimiento", valor: 10 },
];

export const nivelInventario = [
  { categoria: "Filtros", actual: 320, minimo: 100 },
  { categoria: "Frenos", actual: 210, minimo: 150 },
  { categoria: "Aceites", actual: 540, minimo: 200 },
  { categoria: "Suspensión", actual: 95, minimo: 120 },
  { categoria: "Eléctrico", actual: 180, minimo: 80 },
  { categoria: "Motor", actual: 70, minimo: 90 },
];

export type OTEstado = "Abierta" | "En Proceso" | "Cerrada" | "Pendiente Repuesto";

export const ordenesTrabajo = [
  { id: "OT-2025-0421", fecha: "2025-05-28", vehiculo: "Toyota Hilux 2021", cliente: "Logística Andina SA", estado: "En Proceso" as OTEstado, mecanico: "C. Ramírez", marca: "Toyota", modelo: "Hilux" },
  { id: "OT-2025-0422", fecha: "2025-05-28", vehiculo: "Mazda CX-5 2022", cliente: "Pedro Salinas", estado: "Abierta" as OTEstado, mecanico: "J. Vargas", marca: "Mazda", modelo: "CX-5" },
  { id: "OT-2025-0423", fecha: "2025-05-29", vehiculo: "Hyundai Tucson 2020", cliente: "Marta Ríos", estado: "Pendiente Repuesto" as OTEstado, mecanico: "L. Mendoza", marca: "Hyundai", modelo: "Tucson" },
  { id: "OT-2025-0424", fecha: "2025-05-29", vehiculo: "Kia Sportage 2023", cliente: "TransPacífico", estado: "Cerrada" as OTEstado, mecanico: "C. Ramírez", marca: "Kia", modelo: "Sportage" },
  { id: "OT-2025-0425", fecha: "2025-05-30", vehiculo: "Nissan Frontier 2019", cliente: "Minera Sur SAC", estado: "En Proceso" as OTEstado, mecanico: "A. Torres", marca: "Nissan", modelo: "Frontier" },
  { id: "OT-2025-0426", fecha: "2025-05-30", vehiculo: "Chevrolet Onix 2022", cliente: "Lucía Pérez", estado: "Abierta" as OTEstado, mecanico: "J. Vargas", marca: "Chevrolet", modelo: "Onix" },
  { id: "OT-2025-0427", fecha: "2025-05-31", vehiculo: "Ford Ranger 2021", cliente: "Constructora Lima", estado: "Cerrada" as OTEstado, mecanico: "L. Mendoza", marca: "Ford", modelo: "Ranger" },
  { id: "OT-2025-0428", fecha: "2025-05-31", vehiculo: "Toyota Corolla 2020", cliente: "Diego Castillo", estado: "En Proceso" as OTEstado, mecanico: "A. Torres", marca: "Toyota", modelo: "Corolla" },
];

export const detalleOT = {
  servicios: ["Cambio de aceite y filtro", "Revisión de frenos", "Alineamiento"],
  fallas: ["Vibración a alta velocidad", "Pastillas de freno desgastadas"],
  repuestos: [
    { codigo: "FLT-AC-0021", desc: "Filtro de aceite Toyota", cant: 1 },
    { codigo: "ACE-5W30-04", desc: "Aceite sintético 5W30 4L", cant: 1 },
    { codigo: "PAS-FR-T-09", desc: "Pastillas freno delantero", cant: 1 },
  ],
  ejecucion: 65,
};

export type StockEstado = "Óptimo" | "Bajo" | "Crítico" | "Exceso";

export const inventario = [
  { codigo: "FLT-AC-0021", repuesto: "Filtro de aceite", categoria: "Filtros", marca: "Toyota", stock: 84, min: 30, max: 150, estado: "Óptimo" as StockEstado },
  { codigo: "PAS-FR-T-09", repuesto: "Pastillas freno delantero", categoria: "Frenos", marca: "Toyota", stock: 18, min: 25, max: 100, estado: "Bajo" as StockEstado },
  { codigo: "ACE-5W30-04", repuesto: "Aceite sintético 5W30 4L", categoria: "Aceites", marca: "Mobil", stock: 220, min: 80, max: 200, estado: "Exceso" as StockEstado },
  { codigo: "AMR-DEL-22", repuesto: "Amortiguador delantero", categoria: "Suspensión", marca: "KYB", stock: 6, min: 15, max: 60, estado: "Crítico" as StockEstado },
  { codigo: "BAT-12V-70", repuesto: "Batería 12V 70Ah", categoria: "Eléctrico", marca: "Bosch", stock: 32, min: 12, max: 50, estado: "Óptimo" as StockEstado },
  { codigo: "FLT-AIR-15", repuesto: "Filtro de aire", categoria: "Filtros", marca: "Mann", stock: 55, min: 20, max: 120, estado: "Óptimo" as StockEstado },
  { codigo: "BUJ-IRD-04", repuesto: "Bujía iridio", categoria: "Motor", marca: "NGK", stock: 9, min: 40, max: 200, estado: "Crítico" as StockEstado },
  { codigo: "COR-DIS-08", repuesto: "Correa de distribución", categoria: "Motor", marca: "Gates", stock: 14, min: 10, max: 40, estado: "Óptimo" as StockEstado },
];

export const movimientos = [
  { fecha: "2025-05-31", tipo: "Salida", codigo: "FLT-AC-0021", cant: 3, ref: "OT-2025-0428" },
  { fecha: "2025-05-31", tipo: "Entrada", codigo: "BAT-12V-70", cant: 20, ref: "OC-1024" },
  { fecha: "2025-05-30", tipo: "Salida", codigo: "PAS-FR-T-09", cant: 2, ref: "OT-2025-0425" },
  { fecha: "2025-05-30", tipo: "Salida", codigo: "ACE-5W30-04", cant: 5, ref: "OT-2025-0424" },
  { fecha: "2025-05-29", tipo: "Entrada", codigo: "FLT-AIR-15", cant: 40, ref: "OC-1023" },
  { fecha: "2025-05-29", tipo: "Salida", codigo: "AMR-DEL-22", cant: 2, ref: "OT-2025-0423" },
];

export const vehiculosCatalogo = [
  { marca: "Toyota", modelos: ["Hilux", "Corolla", "Yaris", "RAV4", "Fortuner"] },
  { marca: "Hyundai", modelos: ["Tucson", "Accent", "Santa Fe", "Creta"] },
  { marca: "Kia", modelos: ["Sportage", "Rio", "Picanto", "Sorento"] },
  { marca: "Mazda", modelos: ["CX-5", "CX-30", "Mazda 3"] },
  { marca: "Nissan", modelos: ["Frontier", "Versa", "Sentra", "Kicks"] },
  { marca: "Chevrolet", modelos: ["Onix", "Sail", "Tracker"] },
  { marca: "Ford", modelos: ["Ranger", "Escape", "Edge"] },
];

export const fallasCatalogo = [
  { codigo: "FAL-001", desc: "Vibración a alta velocidad" },
  { codigo: "FAL-002", desc: "Ruido en frenos" },
  { codigo: "FAL-003", desc: "Pérdida de potencia" },
  { codigo: "FAL-004", desc: "Consumo excesivo de combustible" },
  { codigo: "FAL-005", desc: "Suspensión dura o ruidosa" },
  { codigo: "FAL-006", desc: "Fuga de aceite motor" },
  { codigo: "FAL-007", desc: "Falla en arranque" },
];

export const serviciosCatalogo = [
  { tipo: "Preventivo", items: ["Cambio de aceite", "Cambio de filtros", "Alineamiento", "Balanceo"] },
  { tipo: "Correctivo", items: ["Reparación de frenos", "Cambio de amortiguadores", "Reparación de motor"] },
  { tipo: "Planchado y Pintura", items: ["Reparación de chasis", "Pintura completa", "Pulido"] },
  { tipo: "Embellecimiento", items: ["Detallado interior", "Polarizado", "Encerado premium"] },
];

export const repuestosMasConsumidos = [
  { repuesto: "Filtro de aceite", consumo: 412 },
  { repuesto: "Aceite 5W30", consumo: 388 },
  { repuesto: "Pastillas freno", consumo: 245 },
  { repuesto: "Filtro de aire", consumo: 198 },
  { repuesto: "Bujías", consumo: 165 },
  { repuesto: "Amortiguadores", consumo: 92 },
];

export const consumoPorMarca = [
  { marca: "Toyota", consumo: 580 },
  { marca: "Hyundai", consumo: 410 },
  { marca: "Kia", consumo: 320 },
  { marca: "Mazda", consumo: 240 },
  { marca: "Nissan", consumo: 210 },
  { marca: "Chevrolet", consumo: 160 },
  { marca: "Ford", consumo: 140 },
];

export const prediccionRepuestos = [
  { repuesto: "Filtro de aceite", demanda: 450, confianza: 92, recomendado: 480, riesgo: "Bajo" },
  { repuesto: "Aceite 5W30 4L", demanda: 410, confianza: 89, recomendado: 430, riesgo: "Bajo" },
  { repuesto: "Pastillas freno delantero", demanda: 280, confianza: 86, recomendado: 310, riesgo: "Medio" },
  { repuesto: "Amortiguador delantero", demanda: 95, confianza: 78, recomendado: 110, riesgo: "Alto" },
  { repuesto: "Bujía iridio", demanda: 180, confianza: 84, recomendado: 200, riesgo: "Alto" },
  { repuesto: "Correa distribución", demanda: 42, confianza: 81, recomendado: 50, riesgo: "Medio" },
  { repuesto: "Batería 12V 70Ah", demanda: 38, confianza: 88, recomendado: 45, riesgo: "Bajo" },
];

export const tendenciaFutura = [
  { mes: "Jun", actual: 1680, prediccion: 1720 },
  { mes: "Jul", actual: 1820, prediccion: 1850 },
  { mes: "Ago", actual: 1750, prediccion: 1790 },
  { mes: "Sep", actual: null, prediccion: 1880 },
  { mes: "Oct", actual: null, prediccion: 1950 },
  { mes: "Nov", actual: null, prediccion: 2040 },
  { mes: "Dic", actual: null, prediccion: 2180 },
];

export const usuarios = [
  { id: 1, nombre: "Carlos Mendoza", email: "cmendoza@bpamotors.com", rol: "Administrador", activo: true },
  { id: 2, nombre: "Lucía Vega", email: "lvega@bpamotors.com", rol: "Jefe de Taller", activo: true },
  { id: 3, nombre: "Miguel Torres", email: "mtorres@bpamotors.com", rol: "Jefe de Almacén", activo: true },
  { id: 4, nombre: "Ana Castillo", email: "acastillo@bpamotors.com", rol: "Jefe de Taller", activo: true },
  { id: 5, nombre: "Roberto Díaz", email: "rdiaz@bpamotors.com", rol: "Jefe de Almacén", activo: false },
];
