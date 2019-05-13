using OpenFin.FDC3.Constants;
using OpenFin.FDC3.Context;
using OpenFin.FDC3.ContextChannels;
using OpenFin.FDC3.Intents;
using System;
using System.Threading.Tasks;
using Fin = Openfin.Desktop;

namespace OpenFin.FDC3
{
    public class DesktopAgent
    {
        private static Fin.Runtime runtimeInstance;

        public static void InitializeAsync()
        {
            var fdcManifestUri = new Uri(Fdc3ServiceConstants.ServiceManifestUrl);
            Initialize(fdcManifestUri);
        }

        public static void Initialize(Uri manifestUri)
        {
            var runtimeOptions = Fin.RuntimeOptions.LoadManifest(manifestUri);
            runtimeInstance = Fin.Runtime.GetRuntimeInstance(runtimeOptions);

            runtimeInstance.Connect(() =>
            {
                var fdcService = runtimeInstance.CreateApplication(runtimeOptions.StartupApplicationOptions);

                fdcService.isRunning(ack =>
                {
                    if (!ack.HasAcked())
                    {
                        fdcService.run();
                    }

                    Connection.Initialize(runtimeInstance);
                    Connection.RegisterChannelTopics();
                });
            });
        }

        public static Task<string> OpenAsync(string name, Context.ContextBase context)
        {
            return Connection.OpenAsync(name, context);
        }

        public static Task<AppIntent> FindIntent(string intent, ContextBase context)
        {
            return Connection.FindIntent(intent, context);
        }

        public static Task<AppIntent[]> FindIntentsByContext(ContextBase context)
        {
            return Connection.FindIntentsByContext(context);
        }

        public static Task Broadcast(ContextBase context)
        {
            return Connection.Broadcast(context);
        }

        public static Task<IntentResolution> RaiseIntent(string intent, ContextBase context, string target)
        {
            return Connection.RaiseIntent(intent, context, target);
        }

        public static void AddContextListener(Action<Context.ContextBase> handler)
        {
            Connection.AddContextListener(handler);
        }

        public static void AddIntentListener(string intent, Action<Context.ContextBase> handler)
        {
            Connection.AddIntentListener(intent, handler);
        }

        public static void UnsubcribeContextListener(Action<Context.ContextBase> handler)
        {
            Connection.UnsubcribeContextListener(handler);
        }

        public static void UnsubscribeIntentListener(string intent)
        {
            Connection.UnsubscribeIntentListener(intent);
        }

        public static void UnsubscribeIntentListener(string intent, Action<ContextBase> handler)
        {
            Connection.UnsubscribeIntentListener(intent, handler);
        }

        public static void AddChannelChangedEventListener(Action<ChannelChangedEvent> handler)
        {
            Connection.AddChannelChangedEventListener(handler);
        }

        public static void RemoveChannelChangedEventListener(Action<ChannelChangedEvent> handler)
        {
            Connection.RemoveChannelChangedEventListener(handler);
        }
    }
}