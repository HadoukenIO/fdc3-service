using Newtonsoft.Json;
using Newtonsoft.Json.Converters;

namespace OpenFin.FDC3.Channels
{
    [JsonConverter(typeof(StringEnumConverter))]
    public enum ChannelType
    {
        Global = 0,
        User
    }
}