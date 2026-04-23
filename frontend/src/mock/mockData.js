// Mock data for SSDBench frontend-only clone

export const mockDisks = [
  {
    id: "nvme0n1",
    path: "/dev/nvme0n1",
    label: "1.81 TB NVMe",
    type: "SSD",
    totalTB: 1.81,
    freeTB: 1.4,
    usedPercent: 23,
    model: "Samsung 990 PRO",
    rotation: "Solid State",
    interface: "NVMe PCIe 4.0",
  },
  {
    id: "sda",
    path: "/dev/sda",
    label: "2.73 TB HDD",
    type: "HDD",
    totalTB: 2.73,
    freeTB: 0.9,
    usedPercent: 67,
    model: "Seagate Barracuda",
    rotation: "7200 RPM",
    interface: "SATA III",
  },
  {
    id: "sdb",
    path: "/dev/sdb",
    label: "4.55 TB HDD",
    type: "HDD",
    totalTB: 4.55,
    freeTB: 4.0,
    usedPercent: 12,
    model: "WD Red Pro",
    rotation: "7200 RPM",
    interface: "SATA III",
  },
];

export const benchmarkStages = [
  { key: "seq_read", label: "Leitura Seq.", icon: "BookOpen" },
  { key: "seq_write", label: "Escrita Seq.", icon: "Pencil" },
  { key: "rand_read", label: "Leitura Aleat.", icon: "Zap" },
  { key: "rand_write", label: "Escrita Aleat.", icon: "Flame" },
  { key: "mixed", label: "Mixed R/W", icon: "Shuffle" },
];

export const mockResults = {
  nvme0n1: {
    seq_read: { value: 3.45, unit: "GB/s", latency: 85, p99: 0.42, rating: 5, color: "green" },
    seq_write: { value: 2.87, unit: "GB/s", latency: 110, p99: 0.58, rating: 5, color: "yellow" },
    rand_read: { value: 482, unit: "K IOPS", latency: 62, p99: 0.31, rating: 5, color: "cyan" },
    rand_write: { value: 215, unit: "K IOPS", latency: 95, p99: 0.75, rating: 5, color: "purple" },
    mixed: { value: 298, unit: "K IOPS", latency: 71, p99: 0.45, rating: 4, color: "orange" },
  },
  sda: {
    seq_read: { value: 180, unit: "MB/s", latency: 4500, p99: 12.4, rating: 3, color: "green" },
    seq_write: { value: 165, unit: "MB/s", latency: 5100, p99: 14.2, rating: 3, color: "yellow" },
    rand_read: { value: 0.25, unit: "K IOPS", latency: 8200, p99: 22.1, rating: 2, color: "cyan" },
    rand_write: { value: 0.18, unit: "K IOPS", latency: 9800, p99: 28.5, rating: 2, color: "purple" },
    mixed: { value: 0.21, unit: "K IOPS", latency: 8900, p99: 25.3, rating: 2, color: "orange" },
  },
  sdb: {
    seq_read: { value: 210, unit: "MB/s", latency: 3800, p99: 10.8, rating: 3, color: "green" },
    seq_write: { value: 195, unit: "MB/s", latency: 4200, p99: 12.1, rating: 3, color: "yellow" },
    rand_read: { value: 0.31, unit: "K IOPS", latency: 7500, p99: 19.4, rating: 2, color: "cyan" },
    rand_write: { value: 0.24, unit: "K IOPS", latency: 8900, p99: 24.3, rating: 2, color: "purple" },
    mixed: { value: 0.27, unit: "K IOPS", latency: 8100, p99: 22.5, rating: 2, color: "orange" },
  },
};

export const mockLogLines = [
  "fio-3.36",
  "Starting 1 process",
  "Jobs: 1 (f=1): [m(1)][100.0%][r=3450MiB/s][w=0KiB/s][r=27600][w=0][r=128KiB][w=128KiB][eta 00m:00s]",
  "  ... (...)",
  "Run status group 0 (all jobs):",
  "   READ: bw=3.45GiB/s (3.70GB/s), 3.45GiB/s-3.45GiB/s (3.70GB/s-3.70GB/s), io=67.2GiB (72.2GB), run=19474-19474msec",
  "  WRITE: bw=2.87GiB/s (3.08GB/s), 2.87GiB/s-2.87GiB/s (3.08GB/s-3.08GB/s), io=55.8GiB (59.9GB), run=19428-19428msec",
  "",
  "Disk stats (read/write):",
  "  nvme0n1: ios=1376128/0, merge=0/0, ticks=102400/0, in_queue=102400, util=99.82%",
];

export const mockHistory = [
  {
    id: "h1",
    date: "2025-07-12 14:22",
    disk: "/dev/nvme0n1",
    type: "SSD",
    seq_read: "3.45 GB/s",
    seq_write: "2.87 GB/s",
    rand_read: "482K IOPS",
    rand_write: "215K IOPS",
    score: 9412,
  },
  {
    id: "h2",
    date: "2025-07-10 09:05",
    disk: "/dev/sda",
    type: "HDD",
    seq_read: "180 MB/s",
    seq_write: "165 MB/s",
    rand_read: "0.25K IOPS",
    rand_write: "0.18K IOPS",
    score: 512,
  },
  {
    id: "h3",
    date: "2025-07-08 18:44",
    disk: "/dev/nvme0n1",
    type: "SSD",
    seq_read: "3.41 GB/s",
    seq_write: "2.82 GB/s",
    rand_read: "478K IOPS",
    rand_write: "212K IOPS",
    score: 9368,
  },
  {
    id: "h4",
    date: "2025-07-05 11:30",
    disk: "/dev/sdb",
    type: "HDD",
    seq_read: "210 MB/s",
    seq_write: "195 MB/s",
    rand_read: "0.31K IOPS",
    rand_write: "0.24K IOPS",
    score: 640,
  },
];

export const metricsGuide = [
  {
    title: "Leitura Sequencial",
    icon: "BookOpen",
    color: "green",
    description:
      "Mede a velocidade de leitura de grandes blocos contíguos de dados. Ideal para avaliar desempenho em transferências de arquivos grandes, streaming de vídeo e backups.",
    unit: "MB/s ou GB/s",
    tip: "Valores altos indicam bom desempenho para cargas de mídia, edição de vídeo e cópia de arquivos grandes.",
  },
  {
    title: "Escrita Sequencial",
    icon: "Pencil",
    color: "yellow",
    description:
      "Mede quão rápido o disco pode gravar grandes blocos contíguos. Crucial para gravação de vídeo, exportação de projetos e escrita em bancos de dados com WAL.",
    unit: "MB/s ou GB/s",
    tip: "Em SSDs, observe a queda quando o cache SLC se esgota — isso indica a velocidade sustentada real.",
  },
  {
    title: "Leitura Aleatória (4K)",
    icon: "Zap",
    color: "cyan",
    description:
      "Mede IOPS em operações de leitura de 4KB espalhadas pelo disco. Reflete a responsividade do sistema, abertura de apps e multitarefa.",
    unit: "IOPS (operações/segundo)",
    tip: "SSDs NVMe típicos: 400K+ IOPS. HDDs: 100–200 IOPS. Diferença enorme em workloads reais.",
  },
  {
    title: "Escrita Aleatória (4K)",
    icon: "Flame",
    color: "purple",
    description:
      "Mede IOPS em pequenas escritas espalhadas. Importante para bancos de dados, logs, virtualização e qualquer carga transacional.",
    unit: "IOPS",
    tip: "Cargas OLTP/DB dependem fortemente desta métrica. Prefira SSDs com alta resistência (TBW).",
  },
  {
    title: "Mixed R/W (70/30)",
    icon: "Shuffle",
    color: "orange",
    description:
      "Simula uma carga mista típica de servidores: 70% leituras e 30% escritas simultâneas. Bom indicador de desempenho do mundo real.",
    unit: "IOPS",
    tip: "Valores próximos da leitura aleatória pura indicam ótimo controlador e firmware.",
  },
  {
    title: "Latência / P99",
    icon: "Clock",
    color: "blue",
    description:
      "Latência média é o tempo típico por operação. P99 é o pior 1% — essencial para prever picos de lentidão em aplicações sensíveis ao tempo.",
    unit: "μs (microssegundos) ou ms",
    tip: "P99 baixo é o que diferencia SSDs enterprise de SSDs consumer em cargas pesadas.",
  },
];
