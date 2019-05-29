using Newtonsoft.Json.Linq;
using Openfin.Desktop;

namespace OpenFin.FDC3
{
    internal static class AckExtensions
    {
        internal static bool HasAcked(this Ack ack)
        { 
            return (bool)(ack.getData() as JValue).Value;
        }
    }
}