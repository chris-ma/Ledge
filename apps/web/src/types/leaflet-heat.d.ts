// leaflet.heat ships no types of its own and patches `L.heatLayer` onto the
// global Leaflet namespace at import time (side-effecting `import
// "leaflet.heat"`), rather than exporting anything itself.
import "leaflet";

declare module "leaflet" {
  interface HeatLayerOptions {
    minOpacity?: number;
    maxZoom?: number;
    max?: number;
    radius?: number;
    blur?: number;
    gradient?: Record<number, string>;
    pane?: string;
  }

  interface HeatLayer extends Layer {
    setLatLngs(latlngs: ReadonlyArray<readonly [number, number, number] | readonly [number, number]>): this;
    addLatLng(latlng: readonly [number, number, number] | readonly [number, number]): this;
    setOptions(options: HeatLayerOptions): this;
  }

  function heatLayer(
    latlngs: ReadonlyArray<readonly [number, number, number] | readonly [number, number]>,
    options?: HeatLayerOptions,
  ): HeatLayer;
}
