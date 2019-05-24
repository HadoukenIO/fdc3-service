using Openfin.Desktop.Messaging;

namespace OpenFin.FDC3.Channels
{
    public class ChannelChangedPayload
    {
        public string Type => "channel-changed";
        public ChannelClient Channel { get; set; }
        public ChannelClient PreviousChannel { get; set; }
    }
}