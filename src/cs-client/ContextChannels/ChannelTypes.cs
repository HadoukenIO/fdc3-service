using Newtonsoft.Json;
using Newtonsoft.Json.Converters;

namespace OpenFin.FDC3.Client.ContextChannels
{
    [JsonConverter(typeof(StringEnumConverter))]
    public enum ChannelType
    {
        Global = 0,
        User
    }
}