// GENERATED from contract/stats.schema.json by scripts/gen-contract.mjs. Do not edit by hand:
// change the schema, then run `npm run gen:contract`.

/**
 * Small numbers the app charts: one file per site, referenced by `stats` in the manifest. Every series says how it was computed, so a teammate can answer 'where does this number come from?'.
 */
export interface SiteStatistics {
  schema: 1;
  site: string;
  series: {
    id: string;
    title: string;
    /**
     * e.g. 'dB', 'km2', '%'. Empty string if unitless.
     */
    unit: string;
    /**
     * id of the layer this series was derived from, when there is one.
     */
    layer?: string;
    /**
     * What area the number covers, in words: which box or polygon, on which grid, and which pixels count.
     */
    region: string;
    /**
     * How the number was computed, in one or two plain sentences.
     */
    method: string;
    points: {
      date: string;
      /**
       * null when the value could not be computed for this date (shown as a gap, never interpolated).
       */
      value: number | null;
      /**
       * Number of valid pixels behind the value.
       */
      n?: number;
    }[];
  }[];
  /**
   * Comparisons across categories instead of across dates, for example a rate for each class of a classified map. Optional.
   */
  bars?: {
    id: string;
    title: string;
    /**
     * e.g. 'detections per km2', '%'. Empty string if unitless.
     */
    unit: string;
    /**
     * id of the classified layer whose classes the categories are, when there is one.
     */
    layer?: string;
    /**
     * What area and period the numbers cover, in words.
     */
    region: string;
    /**
     * How the numbers and their uncertainty were computed, in one or two plain sentences.
     */
    method: string;
    /**
     * @minItems 1
     */
    categories: [
      {
        label: string;
        /**
         * null when the value could not be computed (shown as missing, never as zero).
         */
        value: number | null;
        /**
         * Lower end of the uncertainty interval named in `method`.
         */
        low?: number;
        /**
         * Upper end of the uncertainty interval named in `method`.
         */
        high?: number;
        /**
         * Count behind the value, for example the number of detections.
         */
        n?: number;
        /**
         * Pixel value of the class in `layer`, when the category is a class.
         */
        class?: number;
        note?: string;
      },
      ...{
        label: string;
        /**
         * null when the value could not be computed (shown as missing, never as zero).
         */
        value: number | null;
        /**
         * Lower end of the uncertainty interval named in `method`.
         */
        low?: number;
        /**
         * Upper end of the uncertainty interval named in `method`.
         */
        high?: number;
        /**
         * Count behind the value, for example the number of detections.
         */
        n?: number;
        /**
         * Pixel value of the class in `layer`, when the category is a class.
         */
        class?: number;
        note?: string;
      }[]
    ];
  }[];
}
