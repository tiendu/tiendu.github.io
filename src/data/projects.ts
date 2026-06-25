export interface Project {
  name: string;
  repo: string;
  label: string;
  tech: string;
  summary: string;
  details: string;
  featured?: boolean;
}

export const PROJECTS: Project[] = [
  {
    name: "RunWatch",
    repo: "https://github.com/tiendu/runwatch",
    label: "Process observation / Linux systems",
    tech: "Python · Linux · systemd · cgroups · OpenMetrics",
    summary:
      "A lightweight Linux service and process monitor built for operational visibility without requiring a full observability stack.",
    details:
      "Tracks process trees, CPU, memory, disk I/O, file descriptors, TCP/UDP connections, Unix sockets, and HTTP health checks. Includes structured JSON logs, OpenMetrics output, strict TOML configuration, atomic writes, and persistent monitoring through systemd.",
    featured: true,
  },
  {
    name: "depviz",
    repo: "https://github.com/tiendu/depviz",
    label: "Dependency analysis / Environment inspection",
    tech: "Python · PyPI · Conda · Bioconda · Graph Analysis · CLI",
    summary:
      "A dependency-risk and upgrade-impact inspector for PyPI and Conda/Bioconda environments.",
    details:
      "Resolves package graphs, calculates dependency blast radius and transitive weight, explains why packages are present, estimates upgrade impact, renders ASCII trees, identifies environment conflicts, and caches repeatable analyses.",
  },
  {
    name: "seqgrep",
    repo: "https://github.com/tiendu/seqgrep",
    label: "Sequence search / Bioinformatics",
    tech: "Python · FASTA · FASTQ · Gzip · IUPAC · Multiprocessing",
    summary:
      "A DNA-aware, grep-style search tool for biological sequences.",
    details:
      "Supports literal sequence search, optional IUPAC ambiguity matching, reverse-complement search, circular DNA boundary matches, FASTA/FASTQ input, gzip-compressed files, and chunked multiprocessing for long sequences.",
  },
  {
    name: "Gommitizen",
    repo: "https://github.com/tiendu/gommitizen",
    label: "Commit workflow / Developer tooling",
    tech: "Go · CLI · Git · Conventional Commits",
    summary:
      "A Go implementation of Commitizen for generating consistent conventional commit messages.",
    details:
      "Designed for small, predictable release workflows where commit structure should help review, changelog generation, and long-term repository maintenance.",
  },
  {
    name: "gentr",
    repo: "https://github.com/tiendu/gentr",
    label: "File watching / Command execution",
    tech: "Go · File Watching · Command Execution · CLI",
    summary:
      "A lightweight command runner that watches files and directories, then reruns a command automatically.",
    details:
      "Supports recursive watching, glob and stdin-based input, configurable output, and simple install and uninstall commands.",
  },
];
