// GENERATED from contract/manifest.schema.json by scripts/gen-contract.mjs. Do not edit by hand:
// change the schema, then run `npm run gen:contract`.

/**
 * Lower-case letters, digits and hyphens. Used in file names and URLs.
 */
export type Slug = string;
/**
 * [west, south, east, north] in degrees, EPSG:4326.
 *
 * @minItems 4
 */
export type Bounds = [number, number, number, number];
/**
 * Calendar date in UTC (YYYY-MM-DD) of the start of the acquisition. This matches granule names, the NASA catalog and NASA GIBS layer dates. It can differ from the local date at the site.
 */
export type Date = string;
/**
 * Data maturity. 'sample' means a format-sample or simulated product that is NOT a NISAR observation.
 */
export type Release = 'beta' | 'provisional' | 'validated' | 'sample';
export type Polarization = 'HH' | 'HV' | 'VH' | 'VV';
export type Layer = {
  id: Slug;
  title: string;
  /**
   * per-date: one file per acquisition. pair: one file per (reference, secondary) pair of acquisitions, e.g. a change map. static: exactly one file for the whole site.
   */
  kind: 'per-date' | 'pair' | 'static';
  /**
   * Unit of the physical value, e.g. 'dB'. Empty string for unitless or categorical layers.
   */
  unit: string;
  /**
   * One plain sentence on how to read the layer. Shown in the legend.
   */
  description: string;
  polarization?: Polarization;
  /**
   * Short provenance: how this layer was computed. Details belong in docs/METHODS.md.
   */
  method?: string;
  encoding: Encoding;
  /**
   * Optional hint for drawing a linear-uint8 layer, in physical units. One fixed range for every date of a layer, so a difference between dates is a difference on the ground and not in the stretch.
   */
  display?: {
    /**
     * Lower end of the drawn range. Must be less than max.
     */
    min: number;
    /**
     * Upper end of the drawn range.
     */
    max: number;
    /**
     * Name of a colour ramp the app knows. Must survive colour-blindness; never red against green.
     */
    ramp?: string;
    /**
     * true when the scale has a meaningful centre (for example 0 dB change).
     */
    diverging?: boolean;
  };
  items: LayerItem[];
};
/**
 * How the uint8 pixel values in a file map back to physical values. 0 is always nodata and is declared as nodata inside the file.
 */
export type Encoding =
  | {
      type: 'linear-uint8';
      nodata: 0;
      /**
       * Physical value of pixel value 1.
       */
      lo: number;
      /**
       * Physical value of pixel value 255.
       */
      hi: number;
    }
  | {
      type: 'categorical-uint8';
      nodata: 0;
      /**
       * @minItems 1
       */
      classes: [
        {
          value: number;
          label: string;
          color: string;
        },
        ...{
          value: number;
          label: string;
          color: string;
        }[]
      ];
    };
/**
 * Resolved against the URL of manifest.json itself (so 'sample/hh_2008-10-12.tif' sits next to the manifest). Absolute https URLs are allowed for data hosted elsewhere.
 */
export type Url = string;

/**
 * The single contract between the Python pipeline (which writes web/public/data/manifest.json) and the web app (which reads it and nothing else about the data). Human explanation: docs/DATA_CONTRACT.md. Cross-field rules that JSON Schema cannot express are listed there and enforced by `python -m pipeline validate`.
 */
export interface DataManifest {
  /**
   * Contract version. Bump on any breaking change and update both sides in the same commit.
   */
  schema: 1;
  /**
   * UTC time the manifest was written, ISO 8601 with a trailing Z.
   */
  generated_at: string;
  generator: Generator;
  /**
   * One entry per place. May be empty before the first pipeline run.
   */
  sites: Site[];
}
/**
 * Provenance of the processing, including whether its code was written with AI assistance.
 */
export interface Generator {
  name: string;
  version?: string;
  /**
   * Short hash of the repository commit the pipeline ran from, when known. Ends in '+uncommitted' when the pipeline or contract code had uncommitted changes at the time.
   */
  git_commit?: string;
  ai_assisted: boolean;
  note: string;
}
export interface Site {
  id: Slug;
  title: string;
  /**
   * One or two plain sentences shown with the site.
   */
  summary?: string;
  /**
   * true when this site is NOT built from real NISAR observations. The app must then show `notice` prominently and permanently.
   */
  is_sample?: boolean;
  /**
   * Plain-language notice shown prominently with this site (required in practice when is_sample is true).
   */
  notice?: string;
  bounds: Bounds;
  view?: View;
  source: Source;
  /**
   * Every acquisition the pipeline processed for this site, ascending by date. These are real acquisition dates, never a calendar.
   */
  dates: Acquisition[];
  /**
   * Dates on which the 12-day repeat cycle predicts a pass that has no usable product. The app shows them as missing instead of hiding them.
   */
  missing_passes: {
    date: Date;
    reason: string;
  }[];
  layers: Layer[];
  /**
   * Multi-band files for click queries: one band per date, so one range request returns a pixel's whole history.
   */
  stacks: Stack[];
  /**
   * Resolved against the URL of manifest.json itself (so 'sample/hh_2008-10-12.tif' sits next to the manifest). Absolute https URLs are allowed for data hosted elsewhere.
   */
  stats?: string;
  /**
   * Vector data from independent sources, drawn over the layers. Optional.
   */
  overlays?: Overlay[];
  /**
   * Steps of a guided tour of this site, in order. Optional.
   */
  story?: StoryStep[];
  /**
   * Escape hatch for experiments. Anything the app relies on must be promoted to a real field in this schema.
   */
  extra?: {};
}
/**
 * Optional initial map view. Without it the app fits `bounds`.
 */
export interface View {
  /**
   * [longitude, latitude]. Latitude is limited to what a web map can show.
   *
   * @minItems 2
   */
  center: [number, number];
  zoom: number;
}
export interface Source {
  product: string;
  /**
   * Catalog short name(s) the granules came from.
   */
  collection: string;
  /**
   * 'mixed' only when dates come from more than one release; the app then says so wherever dates are compared.
   */
  release: 'beta' | 'provisional' | 'validated' | 'sample' | 'mixed';
  /**
   * track_direction_frame. Only images of one stack may be compared directly.
   */
  stack: string;
  direction: 'ascending' | 'descending';
  /**
   * Which radar band of the product the layers were read from.
   */
  frequency: 'A' | 'B';
  /**
   * Pixel spacing of the source product in metres.
   */
  posting_m: number;
  /**
   * Pixel spacing after multilooking, before reprojection for display.
   */
  working_resolution_m: number;
  /**
   * EPSG code of the source product grid.
   */
  native_epsg: number;
  citation?: string;
}
export interface Acquisition {
  date: Date;
  /**
   * Acquisition start, UTC.
   */
  datetime: string;
  /**
   * Granule name without the .h5 extension, exactly as in the catalog.
   */
  granule: string;
  /**
   * Processing version (CRID) from the granule name, e.g. P05023.
   */
  version: string;
  release: Release;
  /**
   * Polarizations present in this granule for the frequency used. Read from the file, never assumed.
   *
   * @minItems 1
   */
  pols: [Polarization, ...Polarization[]];
  bandwidth_mhz?: number;
  full_frame?: boolean;
  /**
   * Anything a reader should know about this date (partial frame, quality remark).
   */
  notes?: string;
}
export interface LayerItem {
  url: Url;
  /**
   * Calendar date in UTC (YYYY-MM-DD) of the start of the acquisition. This matches granule names, the NASA catalog and NASA GIBS layer dates. It can differ from the local date at the site.
   */
  date?: string;
  /**
   * Calendar date in UTC (YYYY-MM-DD) of the start of the acquisition. This matches granule names, the NASA catalog and NASA GIBS layer dates. It can differ from the local date at the site.
   */
  reference?: string;
  /**
   * Calendar date in UTC (YYYY-MM-DD) of the start of the acquisition. This matches granule names, the NASA catalog and NASA GIBS layer dates. It can differ from the local date at the site.
   */
  secondary?: string;
  bytes?: number;
}
export interface Stack {
  /**
   * Lower-case letters, digits and hyphens. Used in file names and URLs.
   */
  layer: string;
  url: Url;
  /**
   * Band i (1-based) of the file is the acquisition band_dates[i-1]. Ascending.
   *
   * @minItems 1
   */
  band_dates: [Date, ...Date[]];
  encoding: Encoding;
  /**
   * Approximate ground pixel size of the stack, which may be coarser than the display layer.
   */
  resolution_m: number;
  bytes?: number;
}
/**
 * Vector data drawn on top of the raster layers, for example fire detections from another instrument. It is context from an independent source, never a NISAR measurement, and the app must show its credit wherever it is drawn.
 */
export interface Overlay {
  id: Slug;
  title: string;
  /**
   * points: a GeoJSON FeatureCollection of Point features, coordinates [longitude, latitude] in EPSG:4326.
   */
  kind: 'points';
  url: Url;
  /**
   * One plain sentence on how to read the overlay. Shown in the legend.
   */
  description: string;
  /**
   * Short provenance: where the points come from and how they were selected. Details belong in docs/METHODS.md.
   */
  method?: string;
  /**
   * Who to credit for this data.
   */
  credit: string;
  /**
   * Name of the feature property that holds the UTC calendar date (YYYY-MM-DD) of each point. With it the app can show the points of a period instead of all of them.
   */
  date_property?: string;
  /**
   * First and last UTC date the overlay covers, inclusive. Outside this range the app must say that the overlay has no data, never that there were no points.
   *
   * @minItems 2
   */
  date_range?: [Date, Date];
  /**
   * Feature properties worth showing when a point is selected, in order.
   */
  fields?: {
    name: string;
    label: string;
    unit?: string;
  }[];
  /**
   * Number of features in the file.
   */
  count?: number;
  /**
   * Drawing hint. Must stay readable on the layers it is drawn over and survive colour-blindness.
   */
  color?: string;
  bytes?: number;
}
/**
 * One step of a guided tour: a short text and what the map should show while it is read. Everything a step points at must exist in the same site.
 */
export interface StoryStep {
  id: Slug;
  title: string;
  /**
   * A few plain sentences. Interpretation is worded as a hypothesis.
   */
  text: string;
  /**
   * Lower-case letters, digits and hyphens. Used in file names and URLs.
   */
  layer?: string;
  /**
   * Calendar date in UTC (YYYY-MM-DD) of the start of the acquisition. This matches granule names, the NASA catalog and NASA GIBS layer dates. It can differ from the local date at the site.
   */
  date?: string;
  /**
   * Calendar date in UTC (YYYY-MM-DD) of the start of the acquisition. This matches granule names, the NASA catalog and NASA GIBS layer dates. It can differ from the local date at the site.
   */
  reference?: string;
  /**
   * Calendar date in UTC (YYYY-MM-DD) of the start of the acquisition. This matches granule names, the NASA catalog and NASA GIBS layer dates. It can differ from the local date at the site.
   */
  secondary?: string;
  /**
   * ids of the overlays to switch on.
   */
  overlays?: Slug[];
  view?: View1;
}
/**
 * A map view: centre and zoom.
 */
export interface View1 {
  /**
   * [longitude, latitude]. Latitude is limited to what a web map can show.
   *
   * @minItems 2
   */
  center: [number, number];
  zoom: number;
}
