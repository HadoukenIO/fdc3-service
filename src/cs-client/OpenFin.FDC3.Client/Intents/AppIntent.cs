using OpenFin.FDC3.Directory;

namespace OpenFin.FDC3.Intents
{
    public class AppIntent
    {
        public IntentMetadata Intent { get; set; }
        public Application[] Apps { get; set; }
    }
}