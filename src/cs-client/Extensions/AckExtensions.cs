using Newtonsoft.Json.Linq;
using Fin = Openfin.Desktop;

namespace OpenFin.FDC3
{
    internal static class AckExtensions
    {
        internal static bool HasAcked(this Fin.Ack ack)
        { 
            return (bool)(ack.getData() as JValue).Value;
        }
    }
}