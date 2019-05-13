using Newtonsoft.Json;

namespace OpenFin.FDC3.Directory
{
    public class Icon
    {
        [JsonProperty("icon")]
        public string IconUrl { get; set; }
    }
}