using Newtonsoft.Json;
using Openfin.Desktop;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace OpenFin.FDC3.Channels
{
    public class Identity 
    {
        [JsonProperty("uuid")]
        public string Uuid { get; set; }

        [JsonProperty("name")]
        public string Name  {get; set;}
    }
}
