namespace OpenFin.FDC3.Client.ContextChannels
{
    internal class Channel
    {
        public string Id => "global";
        public ChannelType ChannelType { get; set; }
        public string Name { get; set; }
        public int Color { get; set; }
    }
}