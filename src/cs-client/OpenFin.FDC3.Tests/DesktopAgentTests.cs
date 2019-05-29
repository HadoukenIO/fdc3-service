using FakeItEasy;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using OpenFin.FDC3.Constants;
using OpenFin.FDC3.Context;
using OpenFin.FDC3.Exceptions;
using System;
using System.Threading;
using System.Threading.Tasks;

namespace OpenFin.FDC3.Tests
{
    [TestClass]
    public class DesktopAgentTests
    {
        object locker = new object();
        [TestMethod]
        public async Task FindIntentAsync_SearchingForNonExistentIntentReturnsZeroApplications()
        {
            init();
            var intent = await DesktopAgent.FindIntentAsync("fakeintent");
            Assert.IsNotNull(intent);
            Assert.IsTrue(intent.Apps.Length == 0);
            Assert.AreEqual("fakeintent", intent.Intent.Name);
            Assert.AreEqual("fakeintent", intent.Intent.DisplayName);
        }  

        [TestMethod]
        public void Initialize_CallingInitializeBeforeSettingCompleteHandler_ThrowsException()
        {
            Assert.ThrowsException<OpenFinInitializationException>(() =>
            {
                if (DesktopAgent.InitializationComplete != null)
                    DesktopAgent.InitializationComplete = null;

                DesktopAgent.Initialize();
            });
        }

        [TestMethod]
        public async Task OpenAsync_OpeningNonExistentApplication_ThrowsException()
        {
            init();
            await Assert.ThrowsExceptionAsync<Exception>(async () =>
            {

                try
                {
                    await DesktopAgent.OpenAsync("test-app-1");
                }
                catch (Exception ex)
                {
                    Assert.IsTrue(ex.Message.Contains("No app with name"));
                    throw ex;
                }
            });
        }

        [TestMethod]
        public async Task OpenAsync_OpeningNonExistentApplication_ThrowsExceptionWithSpecificMessage()
        {
            await Assert.ThrowsExceptionAsync<Exception>(async () =>
            {
                try
                {
                    init();
                    await DesktopAgent.OpenAsync("fakeapp");
                }
                catch (Exception ex)
                {
                    Assert.IsTrue(ex.Message.Contains("No app with name"));
                    throw ex;
                }
            });
        }

        [TestMethod]
        public async Task RaiseIntent_CallingNonExistentIntent_ThrowsException()
        {
            await Assert.ThrowsExceptionAsync<Exception>(async () =>
            {
                init();
                await DesktopAgent.RaiseIntentAsync("fakeintent", null, "faketarget");
            });
        }

        [TestMethod]
        public async Task RaiseIntent_CallingNonExistentIntent_ThrowsExceptionWithMessage()
        {
            await Assert.ThrowsExceptionAsync<Exception>(async () =>
            {
                try
                {
                    init();
                    await DesktopAgent.RaiseIntentAsync("fakeintent", null, "faketarget");
                }
                catch (Exception ex)
                {
                    Assert.AreEqual(ex.Message, "No applications available to handle this intent");
                    throw ex;
                }
            });
        }       

        private void init()
        {
            lock (locker)
            {
                if (DesktopAgent.InitializationComplete == null)
                {
                    var tcs = new TaskCompletionSource<object>();

                    DesktopAgent.InitializationComplete += ex =>
                    {
                        tcs.SetResult(null);
                    };

                    DesktopAgent.Initialize();

                    tcs.Task.Wait();
                }
            }
        }
    }
}