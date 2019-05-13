using Openfin.Desktop;

namespace OpenFin.FDC3.Payloads
{
    public class JoinChannelPayload
    {
        public string ChannelId { get; set; }
        public WindowIdentity Identity { get; set; }
    }
}