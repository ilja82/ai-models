# AGENTS.md

## Role & Workflow
You are an autonomous, spec-driven developer agent. Your task is to build the ai-models project.
You must implement the project strictly feature by feature. After completing each feature, you must update this AGENTS.md file by changing the unchecked box [ ] to a checked box [x], commit the changes, and then proceed to the next feature.

---

## Project Overview
**Project Name:** ai-models
**Goal:** Create a Progressive Web App (PWA) that displays a set of AI models, comparing their prices and intelligence through diagrams (Bar charts, Scatter plots) and data tables.

### 1. Technology & Guidelines
* **Framework:** Angular 21 (Use npm and ng commands for setup and development)
* **Platform:** PWA (Must work and look good on Desktop and Mobile)
* **Deployment:** Automatic Deployment as GitHub Pages (using an existing .github/workflows/deploy.yml)
* **Coding Guidelines:**
    * Use clean code principles.
    * Use state-of-the-art framework features (e.g., Standalone components, Signals, modern control flow).
    * Implement small, modular components and files.

### 2. Data Definition
To make editing easier, the AI models should be defined either in a separate YAML or JSON file, or in a separate component.
The data should not be loaded via HTTP at runtime, but should be directly available in the application.

Example YAML structure:

Model-X:
Public Name: GPT-4o
Model Name: gpt-4o-2024-08-06
Input Costs: 2.50
Output Costs: 10.00
Context Window: 128000
Costs To Run Costs: 12.50
Is it available in LiteLLM?: true
Is it available/feasible for local only development?: false
What are the minimum VRAM requirements for local only development?: 0
Overall Intelligence: 95
Coding Intelligence: 97
Agentic Intelligence: 92

---

## Feature Checklist

### Phase 1: Setup & Data Layer
- [x] Ensure environment is set up (correct node version, Angular CLI installed).
- [x] Initialize the Angular 21 PWA project.
- [x] Set up the project structure with modular components.
- [x] Define the AI models data structure in a separate YAML or JSON file, or in a dedicated component. Ensure the data is directly available in the application without HTTP loading.

### Phase 2: Global State & Controls
- [x] Implement global state management (using Angular Signals) for models, filters, and active views.
- [x] Implement an Intelligence Switcher to toggle the active metric between Overall, Coding, and Agentic Intelligence.
- [x] Implement an Availability Toggle to switch on/off LiteLLM and Local Only models (Default: Both enabled).
- [x] Implement a VRAM Filter where users can input their available RAM. Filter out local models that exceed this VRAM.
- [x] Implement a global enable/disable function: Users must be able to disable specific models via a single click across all views. Disabled models should not appear in any charts or tables.

### Phase 3: Data Table View
- [x] Create a table component displaying all active model information.
- [x] Make all columns in the table sortable.
- [x] Make the table filterable (e.g., text search by name).

### Phase 4: Bar Chart View
- [x] Create a Bar Chart component.
- [x] Display the active models as bars.
- [x] Automatically sort the bars by the currently selected Intelligence metric.

### Phase 5: Scatter Plot View
- [x] Create a Scatter Plot component mapping X: Costs To Run Costs, and Y: Intelligence.
- [x] Implement a toggle to switch the X-axis (Costs) between normal price distribution (default) and logarithmic distribution.
- [x] Render models as markers. Use distinctly different colors and shapes depending on availability (LiteLLM, local, or both).
- [x] Display the model name next to its marker.
- [x] Implement an anti-overlap function: Ensure all names and marker shapes do not overlap each other on the canvas.
- [x] Implement hover states: When hovering over a model marker, display a tooltip with full model details.

### Phase 6: Useful Models Algorithm (Pareto Frontier)
- [x] Implement a toggle option to highlight useful models.
- [x] Implement the algorithm based ONLY on the currently shown/filtered models:
    - Identify the model with the highest intelligence (this is automatically useful).
    - Find the next most intelligent model that has strictly lower Costs To Run Costs.
    - Repeat this until no models are available.
    - Ensure a model is NOT highlighted if another model exists that is more (or equally) intelligent AND has less (or equal) costs.
- [x] Visually highlight these calculated models in the plot, bar chart, and table.

### Phase 7: Final Polish
- [x] Verify full PWA functionality (Desktop and Mobile responsiveness).
- [x] Final code review to ensure small components and clean code guidelines are met.