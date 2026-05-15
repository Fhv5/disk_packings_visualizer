# Disk Packing Visualizer

Upgraded version of https://fhv75.github.io/penny-graphs-viewer.

A browser-based research tool for experimenting with equal-radii hard disk packings. Useful for browsing contact classes visually and interactively manipulate disk configurations.

You can access it [here](https://packings.fhenry.site/).

## Core Capabilities

### Interactive Visualization
Browse and interact with different equal-radii hard disk packing configurations. The tool categorizes embeddings by their disk count, allowing for direct visual examination of contact classes and geometric properties rather than analyzing raw coordinates.

### Contact Graph and Convex Hull Rendering
Displays the contact graph and the convex hull for the selected configuration. The convex hull edges are visually separated from the internal edges of the contact graph, and the boundary polygon is rendered to clarify the geometry of the perimeter.

### Perimeter Analysis Display
Calculates and displays the perimeter of the convex hull for the selected configuration. The display mode can be toggled between an exact symbolic representation (if available) and a numeric decimal approximation.

### Rolling Simulation
A simple physics engine that allows defining "motors" to simulate one disk rolling over another at a specified speed and direction.

### Perimeter History
As disks are manipulated manually or via motors, the application dynamically records and plots the perimeter's evolution over time. Useful to know 
if a specific deformation increases or decreases the perimeter.

### Coordinate Control
Granular control over the configuration is provided through an individual undo/redo stack for each disk. Users can explicitly define disk positions using mathematical expressions, pin specific disks to prevent movement during simulation, and snap disks to legal contact positions via drag-and-drop.

### Data Exports
The JSON export module respects the current state of the application's gallery filters. When performing mass exports, the resulting dataset includes only the specific subset of configurations and embeddings currently visible in the UI. Individual configurations can also be exported independently.
