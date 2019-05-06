using Openfin.Desktop;

namespace OpenFin.FDC3.Client.Payloads
{
    public class JoinChannelPayload
    {
        public string ChannelId { get; set; }
        public WindowIdentity Identity { get; set; }
    }
}