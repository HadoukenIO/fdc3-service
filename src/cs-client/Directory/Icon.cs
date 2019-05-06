using Newtonsoft.Json;

namespace OpenFin.FDC3.Client.Directory
{
    public class Icon
    {
        [JsonProperty("icon")]
        public string IconUrl { get; set; }
    }
}