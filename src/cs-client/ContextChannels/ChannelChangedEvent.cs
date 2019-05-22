using Openfin.Desktop.Messaging;

namespace OpenFin.FDC3.ContextChannels
{
    public class ChannelChangedEvent
    {
        public string Type => "channel-changed";
        public ChannelClient Channel { get; set; }
        public ChannelClient PreviousChannel { get; set; }
    }
}