using OpenFin.FDC3.Client.Directory;

namespace OpenFin.FDC3.Client.Intents
{
    public class AppIntent
    {
        public IntentMetadata Intent { get; set; }
        public Application Apps { get; set; }
    }
}