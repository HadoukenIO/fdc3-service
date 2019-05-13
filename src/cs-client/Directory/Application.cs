using System.Collections.Generic;

namespace OpenFin.FDC3.Directory
{
    public class Application
    {
        public string AppId { get; set; }
        public string AppName { get; set; }
        public string Manifest { get; set; }
        public string ManifestType { get; set; }
        public string Version { get; set; }
        public string Tooltip { get; set; }
        public string Description { get; set; }
        public string ContactEmail { get; set; }
        public string SupportEmail { get; set; }
        public string Publisher { get; set; }
        public string Signature { get; set; }
        public Icon[] Icons { get; set; }
        public Dictionary<string, string> CustomConfig { get; set; }
        public Intent[] Intents { get; set; }
    }
}