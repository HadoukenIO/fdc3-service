using Newtonsoft.Json;
using Openfin.Desktop;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace OpenFin.FDC3.Channels
{
    public class Identity : IOpenfinEntity
    {
        [JsonIgnore]
        public Runtime Runtime => throw new NotImplementedException();

        public string Uuid { get; set; }

        public string Name  {get; set;}
    }
}
