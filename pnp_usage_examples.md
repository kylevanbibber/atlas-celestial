# PnP.py Command Line Usage Examples

## Basic Usage

### Default behavior (process agents ending with -1)
```bash
python pnp.py
```
OR
```bash
python pnp.py path/to/your/report.pdf
```

## Agent Filtering Options

### Process only agents ending with -1
```bash
python pnp.py --1
python pnp.py path/to/your/report.pdf --1
```

### Process only agents ending with -2
```bash
python pnp.py --2
python pnp.py path/to/your/report.pdf --2
```

### Process only agents ending with -3
```bash
python pnp.py --3
python pnp.py path/to/your/report.pdf --3
```

### Process ALL agents (no filtering)
**Note: `--all` automatically processes ALL pages in the PDF unless `--pages` is specified**
```bash
python pnp.py --all                           # Processes ALL pages
python pnp.py path/to/your/report.pdf --all  # Processes ALL pages
python pnp.py --all --pages 10               # Process only first 10 pages
```

### Process Specific Number of Pages
Control how many pages to process with `--pages` (default is 5 pages):

```bash
# Process only first 3 pages
python pnp.py --pages 3

# Process first 10 pages with -2 agents
python pnp.py --2 --pages 10

# Process all pages for all agents (--all does this by default)
python pnp.py --all
```

## Output Files

Each run creates unique timestamped Excel files:

**Excel Files:**
- `pnp_extracted_data_agents_1_20241215_142530.xlsx` (for --1 or default)
- `pnp_extracted_data_agents_2_20241215_142530.xlsx` (for --2)
- `pnp_extracted_data_agents_3_20241215_142530.xlsx` (for --3)
- `pnp_extracted_data_all_agents_20241215_142530.xlsx` (for --all)

**Marked PDF Files:**
- `marked_coordinates_agents_1_20241215_142530.pdf`
- `marked_coordinates_agents_2_20241215_142530.pdf`
- `marked_coordinates_agents_3_20241215_142530.pdf`
- `marked_coordinates_all_agents_20241215_142530.pdf`

## Help
```bash
python pnp.py --help
```

Shows all available options and usage information.
