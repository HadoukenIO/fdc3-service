using Fin = Openfin.Desktop;

namespace OpenFin.FDC3.ContextChannels
{
    public class ChannelChangedEvent
    {
        public string Type => "channel-changed";
        public Fin.ChannelClient Channel { get; set; }
        public Fin.ChannelClient PreviousChannel { get; set; }
    }
}